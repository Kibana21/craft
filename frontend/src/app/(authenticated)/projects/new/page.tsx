"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="mx-auto max-w-3xl px-6 py-12">
      <WizardProgress steps={STEPS} currentStep={step} />

      {/* Step content */}
      <div className="rounded-xl border border-[#EBEBEB] bg-white p-8 lg:p-10">
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
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={step === 0 ? () => router.back() : handleBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-3 py-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:border-[#DADCE0] hover:bg-[#F1F3F4] hover:text-[#1F1F1F]"
        >
          {step > 0 && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8l4 4" />
            </svg>
          )}
          {step === 0 ? "Cancel" : "Back"}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="rounded-lg bg-[#D0103A] px-8 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
            className="rounded-lg bg-[#D0103A] px-8 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Creating..." : "Create project →"}
          </button>
        )}
      </div>
    </div>
  );
}
