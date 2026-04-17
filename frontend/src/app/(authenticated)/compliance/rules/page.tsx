"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRules, createRule, updateRule, type ComplianceRule } from "@/lib/api/compliance";
import { queryKeys } from "@/lib/query-keys";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

export default function ComplianceRulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState<{
    rule_text: string;
    category: string;
    severity: "error" | "warning";
  }>({ rule_text: "", category: "disclaimer_required", severity: "error" });
  const [formError, setFormError] = useState<string | null>(null);

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
    mutationFn: (rule: ComplianceRule) =>
      updateRule(rule.id, { is_active: !rule.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceRules() });
    },
  });

  const rules = rulesQuery.data ?? [];

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 5, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
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

      {/* New rule form */}
      {showForm && (
        <Box
          sx={{
            mb: 4,
            borderRadius: "16px",
            border: "1px solid #F0F0F0",
            bgcolor: "#FFFFFF",
            p: 3,
          }}
        >
          <Typography sx={{ mb: 2, fontWeight: 600, color: "#1F1F1F" }}>New rule</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              multiline
              rows={3}
              value={newRule.rule_text}
              onChange={(e) => setNewRule({ ...newRule, rule_text: e.target.value })}
              placeholder="Rule description..."
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#E8EAED" },
                  "&:hover fieldset": { borderColor: "#DADCE0" },
                  "&.Mui-focused fieldset": { borderColor: "#1F1F1F" },
                },
              }}
            />
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
              <Select
                value={newRule.category}
                onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                size="small"
                sx={{
                  borderRadius: "8px",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E8EAED" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#DADCE0" },
                }}
              >
                <MenuItem value="disclaimer_required">Disclaimer required</MenuItem>
                <MenuItem value="prohibited_claim">Prohibited claim</MenuItem>
                <MenuItem value="benefit_illustration">Benefit illustration</MenuItem>
                <MenuItem value="competitor_reference">Competitor reference</MenuItem>
                <MenuItem value="testimonial">Testimonial</MenuItem>
              </Select>
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
              <Button
                onClick={() => createMutation.mutate()}
                disabled={newRule.rule_text.length < 10 || createMutation.isPending}
                disableElevation
                startIcon={
                  createMutation.isPending ? (
                    <CircularProgress size={14} sx={{ color: "#fff" }} />
                  ) : undefined
                }
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
          {rules.length === 0 && (
            <Typography sx={{ fontSize: 14, color: "#9E9E9E", py: 4, textAlign: "center" }}>
              No compliance rules yet. Add one above.
            </Typography>
          )}
          {rules.map((rule) => (
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
                    {rule.category.replace(/_/g, " ")}
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
    </Box>
  );
}
