"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRules, createRule, updateRule, suggestRule, type ComplianceRule } from "@/lib/api/compliance";
import { queryKeys } from "@/lib/query-keys";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

const CATEGORIES = [
  { value: "disclaimer_required", label: "Disclaimer required" },
  { value: "prohibited_claim", label: "Prohibited claim" },
  { value: "benefit_illustration", label: "Benefit illustration" },
  { value: "competitor_reference", label: "Competitor reference" },
  { value: "testimonial", label: "Testimonial" },
];

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  disclaimer_required:
    "Write the rule, or describe what to cover (e.g. \"MAS disclaimer wording, placement, and font size\") then click AI draft.",
  prohibited_claim:
    "Write the rule, or list the areas to cover (e.g. \"guaranteed returns, projected profits, misleading performance claims\") then click AI draft.",
  benefit_illustration:
    "Write the rule, or describe the scope (e.g. \"non-guaranteed projections, assumed rates, and SDIC coverage limits\") then click AI draft.",
  competitor_reference:
    "Write the rule, or describe what to restrict (e.g. \"naming competitors by brand, indirect comparisons on price or coverage\") then click AI draft.",
  testimonial:
    "Write the rule, or note what to cover (e.g. \"individual results disclaimer, source attribution, approval requirements\") then click AI draft.",
};

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value.replace(/_/g, " ");
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    fontSize: 14,
    "& fieldset": { borderColor: "#E8EAED" },
    "&:hover fieldset": { borderColor: "#DADCE0" },
    "&.Mui-focused fieldset": { borderColor: "#1F1F1F", borderWidth: 1 },
  },
};

interface CategoryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Extra options already in use (e.g. custom categories from existing rules). */
  extraOptions?: string[];
}

function CategoryAutocomplete({ value, onChange, extraOptions = [] }: CategoryAutocompleteProps) {
  const builtIn = CATEGORIES.map((c) => c.value);
  const custom = extraOptions.filter((o) => !builtIn.includes(o));
  const options = [...builtIn, ...custom];

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => {
        if (!newValue) return;
        if (newValue.startsWith("__new__")) {
          onChange(newValue.slice(7).trim().toLowerCase().replace(/\s+/g, "_"));
        } else {
          onChange(newValue);
        }
      }}
      onInputChange={(_, newInput, reason) => {
        // freeSolo: keep the typed value live so the user can save a custom tag
        if (reason === "input") onChange(newInput);
      }}
      options={options}
      getOptionLabel={(opt) => (opt.startsWith("__new__") ? opt.slice(7) : categoryLabel(opt))}
      freeSolo
      size="small"
      sx={{ minWidth: 220 }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Category"
          sx={textFieldSx}
        />
      )}
      filterOptions={(opts, state) => {
        const inputLower = state.inputValue.toLowerCase();
        const filtered = opts.filter((o) =>
          categoryLabel(o).toLowerCase().includes(inputLower)
        );
        if (
          state.inputValue.trim() &&
          !opts.some(
            (o) =>
              o === state.inputValue.trim().toLowerCase().replace(/\s+/g, "_") ||
              categoryLabel(o).toLowerCase() === inputLower
          )
        ) {
          filtered.push(`__new__${state.inputValue.trim()}`);
        }
        return filtered;
      }}
      renderOption={(props, opt) => {
        if (opt.startsWith("__new__")) {
          const label = opt.slice(7);
          return (
            <li {...props} key={opt}>
              <Typography sx={{ fontSize: 13, color: "#D0103A", fontWeight: 500 }}>
                + Add &ldquo;{label}&rdquo; as new category
              </Typography>
            </li>
          );
        }
        const isCustom = !builtIn.includes(opt);
        return (
          <li {...props} key={opt}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 13 }}>{categoryLabel(opt)}</Typography>
              {isCustom && (
                <Box component="span" sx={{ fontSize: 10, color: "#9E9E9E", bgcolor: "#F7F7F7", px: 0.75, py: 0.1, borderRadius: 1 }}>
                  custom
                </Box>
              )}
            </Box>
          </li>
        );
      }}
    />
  );
}

// ── Edit rule dialog ─────────────────────────────────────────────────────────

interface EditRuleDialogProps {
  rule: ComplianceRule;
  onClose: () => void;
}

function EditRuleDialog({ rule, onClose }: EditRuleDialogProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(rule.rule_text);
  const [category, setCategory] = useState(rule.category);
  const [severity, setSeverity] = useState<"error" | "warning">(rule.severity);
  const [error, setError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const editMutation = useMutation({
    mutationFn: () => updateRule(rule.id, { rule_text: text, category, severity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceRules() });
      onClose();
    },
    onError: () => setError("Failed to save. Please try again."),
  });

  const handleAiDraft = async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const { rule_text } = await suggestRule(category, text || undefined);
      setText(rule_text);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      setError(detail ?? "AI suggestion failed — please write the rule manually.");
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pb: 1 }}>Edit rule</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
          {/* Category + severity first so AI draft uses the correct category */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <CategoryAutocomplete
              value={category}
              onChange={setCategory}
              extraOptions={[rule.category]}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              {(["error", "warning"] as const).map((s) => (
                <Button
                  key={s}
                  onClick={() => setSeverity(s)}
                  disableElevation
                  size="small"
                  sx={{
                    borderRadius: 9999,
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    px: 2,
                    ...(severity === s
                      ? {
                          bgcolor: s === "error" ? "#D0103A" : "#B45309",
                          color: "#fff",
                          "&:hover": { bgcolor: s === "error" ? "#B80E33" : "#92400E" },
                        }
                      : {
                          border: "1px solid #E8EAED",
                          color: "#5F6368",
                          bgcolor: "transparent",
                          "&:hover": { bgcolor: "#F8F9FA" },
                        }),
                  }}
                >
                  {s}
                </Button>
              ))}
            </Box>
          </Box>
          <Box sx={{ position: "relative" }}>
            <TextField
              multiline
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={CATEGORY_PLACEHOLDERS[category] ?? "Describe the compliance rule…"}
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#E8EAED" },
                  "&:hover fieldset": { borderColor: "#DADCE0" },
                  "&.Mui-focused fieldset": { borderColor: "#1F1F1F" },
                },
                "& textarea::placeholder": { fontSize: 13, color: "#BDBDBD", fontStyle: "italic" },
              }}
            />
            <Box
              component="button"
              onClick={handleAiDraft}
              disabled={isSuggesting}
              sx={{
                position: "absolute",
                bottom: 8,
                right: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1.25,
                py: 0.4,
                borderRadius: 9999,
                border: "1px solid #D0103A",
                bgcolor: "transparent",
                color: "#D0103A",
                fontSize: 11,
                fontWeight: 600,
                cursor: isSuggesting ? "default" : "pointer",
                opacity: isSuggesting ? 0.6 : 1,
                transition: "all 0.15s",
                "&:hover:not(:disabled)": { bgcolor: "#FFF1F4" },
              }}
            >
              {isSuggesting ? (
                <CircularProgress size={10} sx={{ color: "#D0103A" }} />
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
                </svg>
              )}
              {isSuggesting ? "Drafting…" : "AI draft"}
            </Box>
          </Box>
          <Typography sx={{ fontSize: 11, color: "#9E9E9E", mt: -1 }}>
            Tip: edit the text first to guide the AI, or leave it to get a fresh draft for this category.
          </Typography>
          {error && (
            <Typography sx={{ fontSize: 13, color: "#D0103A" }}>{error}</Typography>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, pt: 0.5 }}>
            <Button
              onClick={onClose}
              variant="outlined"
              disableElevation
              sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={text.length < 10 || editMutation.isPending}
              disableElevation
              startIcon={editMutation.isPending ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                bgcolor: "#1F1F1F",
                color: "#fff",
                px: 3,
                fontWeight: 600,
                "&:hover": { bgcolor: "#333" },
                "&.Mui-disabled": { opacity: 0.4, color: "#fff", bgcolor: "#1F1F1F" },
              }}
            >
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ComplianceRulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState<{ rule_text: string; category: string; severity: "error" | "warning" }>({
    rule_text: "",
    category: "disclaimer_required",
    severity: "error",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const rulesQuery = useQuery({
    queryKey: queryKeys.complianceRules(),
    queryFn: () => fetchRules(),
  });

  const createMutation = useMutation({
    mutationFn: () => createRule(newRule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceRules() });
      setNewRule({ rule_text: "", category: "disclaimer_required", severity: "error" });
      setShowForm(false);
      setFormError(null);
    },
    onError: () => setFormError("Failed to save rule. Please try again."),
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: ComplianceRule) => updateRule(rule.id, { is_active: !rule.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceRules() });
    },
  });

  const rules = rulesQuery.data ?? [];

  // Stats
  const activeCount = rules.filter((r) => r.is_active).length;
  const inactiveCount = rules.length - activeCount;
  const categoryCount = new Set(rules.map((r) => r.category)).size;

  // Filter
  const presentCategories = [...new Set(rules.map((r) => r.category))];
  const filtered = rules.filter((r) => {
    if (statusFilter === "active" && !r.is_active) return false;
    if (statusFilter === "inactive" && r.is_active) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return true;
  });

  const pillSx = (active: boolean) => ({
    px: 1.5,
    py: 0.4,
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    border: "1px solid",
    borderColor: active ? "#1F1F1F" : "#E8EAED",
    bgcolor: active ? "#1F1F1F" : "transparent",
    color: active ? "#fff" : "#5F6368",
    transition: "all 0.1s",
    "&:hover": { borderColor: "#1F1F1F", color: active ? "#fff" : "#1F1F1F" },
  });

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1F1F1F", fontSize: "28px" }}>
            Compliance Rules
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "1rem", color: "#5F6368" }}>
            MAS compliance rules applied to all artifact content
          </Typography>
        </Box>
        <Button
          onClick={() => { setShowForm(!showForm); setFormError(null); }}
          disableElevation
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            bgcolor: "#D0103A",
            color: "#fff",
            px: 3,
            py: 1.5,
            fontWeight: 600,
            fontSize: "1rem",
            "&:hover": { bgcolor: "#B80E33" },
          }}
        >
          + Add rule
        </Button>
      </Box>

      {/* Stats strip */}
      {rules.length > 0 && (
        <Typography sx={{ fontSize: 13, color: "#9E9E9E", mb: 3 }}>
          {activeCount} active · {inactiveCount} inactive · {categoryCount} {categoryCount === 1 ? "category" : "categories"}
        </Typography>
      )}

      {/* New rule form */}
      {showForm && (
        <Box sx={{ mb: 4, borderRadius: "16px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", p: 3 }}>
          <Typography sx={{ mb: 2, fontWeight: 600, color: "#1F1F1F" }}>New rule</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Category + severity first so the placeholder below updates contextually */}
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
              <CategoryAutocomplete
                value={newRule.category}
                onChange={(v) => setNewRule({ ...newRule, category: v, rule_text: "" })}
                extraOptions={rules.map((r) => r.category)}
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                {(["error", "warning"] as const).map((s) => (
                  <Button
                    key={s}
                    onClick={() => setNewRule({ ...newRule, severity: s })}
                    disableElevation
                    size="small"
                    sx={{
                      borderRadius: 9999,
                      textTransform: "none",
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      px: 2,
                      ...(newRule.severity === s
                        ? {
                            bgcolor: s === "error" ? "#D0103A" : "#B45309",
                            color: "#fff",
                            "&:hover": { bgcolor: s === "error" ? "#B80E33" : "#92400E" },
                          }
                        : {
                            border: "1px solid #E8EAED",
                            color: "#5F6368",
                            bgcolor: "transparent",
                            "&:hover": { bgcolor: "#F8F9FA" },
                          }),
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </Box>
            </Box>
            <Box sx={{ position: "relative" }}>
              <TextField
                multiline
                rows={3}
                value={newRule.rule_text}
                onChange={(e) => setNewRule({ ...newRule, rule_text: e.target.value })}
                placeholder={CATEGORY_PLACEHOLDERS[newRule.category] ?? "Describe the compliance rule…"}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                    "& fieldset": { borderColor: "#E8EAED" },
                    "&:hover fieldset": { borderColor: "#DADCE0" },
                    "&.Mui-focused fieldset": { borderColor: "#1F1F1F" },
                  },
                  "& textarea::placeholder": { fontSize: 13, color: "#BDBDBD", fontStyle: "italic" },
                }}
              />
              {/* AI suggest button — bottom-right corner of the textarea */}
              <Box
                component="button"
                onClick={async () => {
                  // Whatever is already in the textarea is treated as guidance for the AI.
                  // Empty textarea → AI picks a standard rule for the category.
                  setIsSuggesting(true);
                  setFormError(null);
                  try {
                    const { rule_text } = await suggestRule(newRule.category, newRule.rule_text || undefined);
                    setNewRule((r) => ({ ...r, rule_text }));
                  } catch (err: unknown) {
                    const detail = (err as { detail?: string })?.detail;
                    setFormError(detail ?? "AI suggestion failed — please write the rule manually.");
                  } finally {
                    setIsSuggesting(false);
                  }
                }}
                disabled={isSuggesting}
                sx={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 9999,
                  border: "1px solid #D0103A",
                  bgcolor: "transparent",
                  color: "#D0103A",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: isSuggesting ? "default" : "pointer",
                  opacity: isSuggesting ? 0.6 : 1,
                  transition: "all 0.15s",
                  "&:hover:not(:disabled)": { bgcolor: "#FFF1F4" },
                }}
              >
                {isSuggesting ? (
                  <CircularProgress size={10} sx={{ color: "#D0103A" }} />
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
                  </svg>
                )}
                {isSuggesting ? "Drafting…" : "AI draft"}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 11, color: "#9E9E9E", mt: -1 }}>
              Tip: type areas you want covered first, then click <strong>AI draft</strong> — the AI will use your notes to write the rule.
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={newRule.rule_text.length < 10 || createMutation.isPending}
                disableElevation
                startIcon={createMutation.isPending ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  bgcolor: "#188038",
                  color: "#fff",
                  px: 3,
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#146830" },
                  "&.Mui-disabled": { opacity: 0.4, color: "#fff", bgcolor: "#188038" },
                }}
              >
                {createMutation.isPending ? "Saving…" : "Save rule"}
              </Button>
            </Box>
            {formError && (
              <Typography sx={{ fontSize: 13, color: "#D0103A" }}>{formError}</Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Filter bar */}
      {rules.length > 0 && (
        <Box sx={{ mb: 3, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          {(["all", "active", "inactive"] as const).map((f) => (
            <Box
              key={f}
              component="button"
              onClick={() => setStatusFilter(f)}
              sx={pillSx(statusFilter === f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Box>
          ))}

          {presentCategories.length > 1 && (
            <>
              <Box sx={{ width: "1px", height: 20, bgcolor: "#E8EAED", mx: 0.5 }} />
              {presentCategories.map((cat) => (
                <Box
                  key={cat}
                  component="button"
                  onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
                  sx={pillSx(categoryFilter === cat)}
                >
                  {categoryLabel(cat)}
                </Box>
              ))}
            </>
          )}
        </Box>
      )}

      {/* Rules list */}
      {rulesQuery.isPending ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: "16px" }} />
          ))}
        </Box>
      ) : rulesQuery.isError && !rulesQuery.data ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography sx={{ fontSize: 14, color: "#5F6368", mb: 1.5 }}>
            Could not load compliance rules.
          </Typography>
          <Button
            onClick={() => rulesQuery.refetch()}
            variant="outlined"
            disableElevation
            sx={{ borderRadius: 9999, textTransform: "none", fontSize: 13, borderColor: "#E8EAED", color: "#1F1F1F" }}
          >
            {rulesQuery.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 && (
            <Typography sx={{ fontSize: 14, color: "#9E9E9E", py: 4, textAlign: "center" }}>
              {rules.length === 0 ? "No compliance rules yet. Add one above." : "No rules match this filter."}
            </Typography>
          )}
          {filtered.map((rule) => (
            <Box
              key={rule.id}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 2,
                borderRadius: "16px",
                border: "1px solid #F0F0F0",
                bgcolor: "#FFFFFF",
                p: 2.5,
                opacity: rule.is_active ? 1 : 0.5,
                transition: "opacity 0.2s",
              }}
            >
              {/* Severity icon */}
              <Box
                sx={{
                  mt: 0.5,
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#fff",
                  bgcolor: rule.severity === "error" ? "#D0103A" : "#B45309",
                }}
              >
                {rule.severity === "error" ? "!" : "⚠"}
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#1F1F1F" }}>
                  {rule.rule_text}
                </Typography>
                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                  <Box
                    component="span"
                    sx={{
                      borderRadius: 9999,
                      bgcolor: "#F8F9FA",
                      px: 1.5,
                      py: 0.25,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "#5F6368",
                    }}
                  >
                    {categoryLabel(rule.category)}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      borderRadius: 9999,
                      px: 1.5,
                      py: 0.25,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      ...(rule.severity === "error"
                        ? { bgcolor: "#FCE8E6", color: "#C5221F" }
                        : { bgcolor: "#FEF7E0", color: "#B45309" }),
                    }}
                  >
                    {rule.severity}
                  </Box>
                </Box>
              </Box>

              {/* Edit button */}
              <Tooltip title="Edit rule" placement="top">
                <Box
                  component="button"
                  onClick={() => setEditingRule(rule)}
                  sx={{
                    flexShrink: 0,
                    mt: 0.25,
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    border: "1px solid #E8EAED",
                    bgcolor: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9E9E9E",
                    "&:hover": { borderColor: "#DADCE0", color: "#1F1F1F", bgcolor: "#F7F7F7" },
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Box>
              </Tooltip>

              {/* Active toggle */}
              <Tooltip title={rule.is_active ? "Click to deactivate" : "Click to activate"} placement="left">
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
                  {toggleMutation.isPending && toggleMutation.variables?.id === rule.id ? (
                    <Box sx={{ width: 36, display: "flex", justifyContent: "center", py: 1 }}>
                      <CircularProgress size={16} sx={{ color: "#9E9E9E" }} />
                    </Box>
                  ) : (
                    <Switch
                      checked={rule.is_active}
                      onChange={() => toggleMutation.mutate(rule)}
                      size="small"
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: "#188038" },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#188038" },
                      }}
                    />
                  )}
                  <Typography sx={{ fontSize: 10, color: rule.is_active ? "#188038" : "#9E9E9E", fontWeight: 600, lineHeight: 1 }}>
                    {rule.is_active ? "On" : "Off"}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      {/* Edit dialog */}
      {editingRule && (
        <EditRuleDialog
          key={editingRule.id}
          rule={editingRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </Box>
  );
}
