"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useAuth } from "@/components/providers/auth-provider";
import { WizardProgress } from "@/components/projects/wizard/wizard-progress";
import { StepPurposeType } from "@/components/projects/wizard/step-purpose-type";
import { StepBrief } from "@/components/projects/wizard/step-brief";
import { StepBrandKit } from "@/components/projects/wizard/step-brand-kit";
import { StepSuggestions } from "@/components/projects/wizard/step-suggestions";
import { createProject } from "@/lib/api/projects";
import { isCreatorRole } from "@/lib/auth";
import type { ProjectPurpose } from "@/types/project";

// Fallback suggestions per purpose type (mirrors backend)
const FALLBACK_SUGGESTIONS: Record<string, { type: string; name: string; description: string; audience: string }[]> = {
  product_launch: [
    { type: "video", name: "Agent training video (60s)", description: "Internal — agents must know the product", audience: "internal" },
    { type: "video", name: "Customer explainer video (30s)", description: "External — social + WhatsApp", audience: "external" },
    { type: "poster", name: "Instagram launch poster (1:1)", description: "External — social media", audience: "external" },
    { type: "whatsapp_card", name: "WhatsApp agent broadcast card", description: "Both — agent sends to clients", audience: "both" },
    { type: "slide_deck", name: "Product fact sheet deck", description: "Internal — reference material for agents", audience: "internal" },
  ],
  campaign: [
    { type: "poster", name: "Instagram campaign poster (1:1)", description: "External — social media", audience: "external" },
    { type: "whatsapp_card", name: "WhatsApp promotional card", description: "External — client outreach", audience: "external" },
    { type: "reel", name: "Campaign reel (9:16)", description: "External — Instagram/TikTok", audience: "external" },
    { type: "story", name: "Social media story", description: "External — Instagram stories", audience: "external" },
  ],
  seasonal: [
    { type: "poster", name: "Festive greeting poster", description: "External — seasonal social media", audience: "external" },
    { type: "whatsapp_card", name: "Greeting card (WhatsApp)", description: "External — personal client greeting", audience: "external" },
    { type: "reel", name: "Seasonal reel (9:16)", description: "External — festive social content", audience: "external" },
  ],
  agent_enablement: [
    { type: "video", name: "Training video (60s)", description: "Internal — agent onboarding", audience: "internal" },
    { type: "infographic", name: "Product knowledge infographic", description: "Internal — quick reference", audience: "internal" },
    { type: "slide_deck", name: "Agent training slide deck", description: "Internal — presentation material", audience: "internal" },
  ],
};

const STEPS = ["Type", "Brief", "Brand Kit", "Suggestions"];

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const projectType = searchParams.get("type") === "team" ? "team" : "personal";
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [purpose, setPurpose] = useState<ProjectPurpose | null>(null);
  const [brief, setBrief] = useState({
    name: "",
    product: "",
    target_audience: "",
    campaign_period: "",
    key_message: "",
  });
  const [suggestions, setSuggestions] = useState<
    { type: string; name: string; description: string; audience: string; selected: boolean }[]
  >([]);

  const isCreator = user ? isCreatorRole(user.role) : false;

  const canProceed = () => {
    if (step === 0) return purpose !== null;
    if (step === 1) return brief.name.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step === 0 && purpose) {
      // Pre-populate suggestions when moving from purpose to brief
      const templates = FALLBACK_SUGGESTIONS[purpose] || FALLBACK_SUGGESTIONS.campaign;
      setSuggestions(templates.map((t) => ({ ...t, selected: true })));
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleToggleSuggestion = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleSubmit = async () => {
    if (!purpose) return;
    setIsSubmitting(true);

    try {
      const project = await createProject({
        name: brief.name,
        type: isCreator ? projectType : "personal",
        purpose,
        product: brief.product || undefined,
        target_audience: brief.target_audience || undefined,
        campaign_period: brief.campaign_period || undefined,
        key_message: brief.key_message || undefined,
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 768, px: 3, py: 6 }}>
      <WizardProgress steps={STEPS} currentStep={step} />

      {/* Step content */}
      <Box
        sx={{
          borderRadius: "16px",
          border: "1px solid #F0F0F0",
          bgcolor: "#FFFFFF",
          p: { xs: 4, lg: 5 },
        }}
      >
        {step === 0 && (
          <StepPurposeType value={purpose} onChange={setPurpose} />
        )}
        {step === 1 && <StepBrief value={brief} onChange={setBrief} />}
        {step === 2 && <StepBrandKit />}
        {step === 3 && purpose && (
          <StepSuggestions
            purpose={purpose}
            suggestions={suggestions}
            onToggle={handleToggleSuggestion}
          />
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ mt: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Back / Cancel */}
        <Button
          onClick={step === 0 ? () => router.back() : handleBack}
          variant="outlined"
          disableElevation
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            borderColor: "#E8EAED",
            color: "#5F6368",
            fontSize: 13,
            fontWeight: 500,
            px: 1.5,
            py: 0.75,
            gap: 0.5,
            "&:hover": {
              borderColor: "#DADCE0",
              bgcolor: "#F1F3F4",
              color: "#1F1F1F",
            },
          }}
        >
          {step > 0 && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8l4 4" />
            </svg>
          )}
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {/* Continue / Create */}
        {step < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 600,
              px: 4,
              py: 1.5,
              "&:hover": { bgcolor: "#B80E33" },
              "&.Mui-disabled": { opacity: 0.4, color: "#FFFFFF", bgcolor: "#D0103A" },
            }}
          >
            Continue →
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 600,
              px: 4,
              py: 1.5,
              "&:hover": { bgcolor: "#B80E33" },
              "&.Mui-disabled": { opacity: 0.4, color: "#FFFFFF", bgcolor: "#D0103A" },
            }}
          >
            {isSubmitting ? "Creating..." : "Create project →"}
          </Button>
        )}
      </Box>
    </Box>
  );
}
