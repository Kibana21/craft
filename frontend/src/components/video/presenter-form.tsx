"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import { generateAppearanceDescription, suggestAppearanceKeywords } from "@/lib/api/presenters";
import type { SpeakingStyle, CreatePresenterData } from "@/types/presenter";

const SPEAKING_STYLES: { value: SpeakingStyle; label: string; description: string }[] = [
  { value: "authoritative", label: "Authoritative", description: "Confident and expert, commands trust" },
  { value: "conversational", label: "Conversational", description: "Warm and natural, like a trusted friend" },
  { value: "enthusiastic", label: "Enthusiastic", description: "Energetic and compelling, high energy" },
  { value: "empathetic", label: "Empathetic", description: "Caring and supportive, emotionally resonant" },
];

interface PresenterFormProps {
  onSubmit: (data: CreatePresenterData, saveToLibrary: boolean) => Promise<void>;
  isSubmitting: boolean;
}

export function PresenterForm({ onSubmit, isSubmitting }: PresenterFormProps) {
  const [name, setName] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [keywords, setKeywords] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState<SpeakingStyle>("conversational");
  const [fullDescription, setFullDescription] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [keywordError, setKeywordError] = useState("");

  const handleSuggestKeywords = async () => {
    if (!name.trim() || !ageRange.trim()) return;
    setIsSuggestingKeywords(true);
    setKeywordError("");
    try {
      const suggested = await suggestAppearanceKeywords(name, ageRange, speakingStyle);
      setKeywords(suggested);
    } catch {
      setKeywordError("Couldn't suggest keywords. You can type them manually.");
    } finally {
      setIsSuggestingKeywords(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!keywords.trim()) return;
    setIsGenerating(true);
    setGenerateError("");
    try {
      const desc = await generateAppearanceDescription(keywords, speakingStyle);
      setFullDescription(desc);
    } catch {
      setGenerateError("Failed to generate description. Please try again or write manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(
      {
        name,
        age_range: ageRange,
        appearance_keywords: keywords,
        full_appearance_description: fullDescription,
        speaking_style: speakingStyle,
        is_library: saveToLibrary,
      },
      saveToLibrary
    );
  };

  const isValid = name && ageRange && keywords && fullDescription && speakingStyle;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        <TextField
          label="Presenter name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah Chen"
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Age range"
          value={ageRange}
          onChange={(e) => setAgeRange(e.target.value)}
          placeholder="e.g. 30–40"
          required
          fullWidth
          size="small"
        />
      </Box>

      <FormControl fullWidth size="small" required>
        <InputLabel>Speaking style</InputLabel>
        <Select
          value={speakingStyle}
          label="Speaking style"
          onChange={(e) => setSpeakingStyle(e.target.value as SpeakingStyle)}
        >
          {SPEAKING_STYLES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.label}</Typography>
                <Typography variant="caption" color="text.secondary">{s.description}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Box sx={{ mb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: "#484848" }}>
            Appearance keywords <Box component="span" sx={{ color: "#D0103A" }}>*</Box>
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={handleSuggestKeywords}
            disabled={!name.trim() || !ageRange.trim() || isSuggestingKeywords}
            startIcon={
              isSuggestingKeywords ? (
                <CircularProgress size={12} sx={{ color: "#D0103A" }} />
              ) : (
                <Box component="span" sx={{ fontSize: "14px" }}>✦</Box>
              )
            }
            sx={{
              textTransform: "none",
              fontSize: "12px",
              fontWeight: 500,
              color: "#D0103A",
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              "&:hover": { bgcolor: "#FFF1F4" },
              "&:disabled": { color: "#ABABAB" },
            }}
          >
            {isSuggestingKeywords ? "Suggesting…" : "Suggest with AI"}
          </Button>
        </Box>
        <TextField
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g. East Asian woman, shoulder-length black hair, navy blazer, modern office"
          required
          fullWidth
          size="small"
          multiline
          rows={2}
          helperText={
            keywordError
              ? keywordError
              : "Describe physical features, clothing style, and setting — used to generate the AI description"
          }
          error={!!keywordError}
        />
        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleGenerateDescription}
            disabled={!keywords.trim() || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={14} /> : undefined}
            sx={{ borderColor: "#D0103A", color: "#D0103A", "&:hover": { borderColor: "#A00D2E", bgcolor: "transparent" } }}
          >
            {isGenerating ? "Generating…" : "Generate description with AI →"}
          </Button>
          {generateError && (
            <Typography variant="caption" color="error">{generateError}</Typography>
          )}
        </Box>
      </Box>

      <TextField
        label="Full appearance description"
        value={fullDescription}
        onChange={(e) => setFullDescription(e.target.value)}
        placeholder="A professional presenter with warm features and a calm, assured presence…"
        required
        fullWidth
        multiline
        rows={4}
        helperText="This paragraph is sent directly to the AI video model — be specific and visual"
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={saveToLibrary}
            onChange={(e) => setSaveToLibrary(e.target.checked)}
            sx={{ color: "#D0103A", "&.Mui-checked": { color: "#D0103A" } }}
          />
        }
        label={
          <Typography variant="body2">
            Save to presenter library for future use
          </Typography>
        }
      />

      <Button
        type="submit"
        variant="contained"
        disabled={!isValid || isSubmitting}
        sx={{
          alignSelf: "flex-start",
          bgcolor: "#D0103A",
          "&:hover": { bgcolor: "#A00D2E" },
          "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
          px: 4,
          py: 1.25,
          borderRadius: 2,
          fontWeight: 600,
          textTransform: "none",
        }}
      >
        {isSubmitting ? "Saving…" : "Use this presenter"}
      </Button>
    </Box>
  );
}
