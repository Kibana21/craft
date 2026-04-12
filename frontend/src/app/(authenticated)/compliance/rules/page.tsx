"use client";

import { useEffect, useState } from "react";
import { fetchRules, createRule, updateRule, type ComplianceRule } from "@/lib/api/compliance";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";

export default function ComplianceRulesPage() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState<{ rule_text: string; category: string; severity: "error" | "warning" }>({ rule_text: "", category: "disclaimer_required", severity: "error" });

  const loadRules = () => {
    fetchRules().then(setRules).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadRules(); }, []);

  const handleCreate = async () => {
    await createRule(newRule);
    setNewRule({ rule_text: "", category: "disclaimer_required", severity: "error" });
    setShowForm(false);
    loadRules();
  };

  const handleToggle = async (rule: ComplianceRule) => {
    await updateRule(rule.id, { is_active: !rule.is_active });
    loadRules();
  };

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
          onClick={() => setShowForm(!showForm)}
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
                onClick={handleCreate}
                disabled={newRule.rule_text.length < 10}
                disableElevation
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
                Save rule
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Rules list */}
      {isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: "16px" }} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                    {rule.category.replace("_", " ")}
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

              {/* Toggle button */}
              <Button
                onClick={() => handleToggle(rule)}
                disableElevation
                size="small"
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  px: 1.5,
                  py: 0.75,
                  ...(rule.is_active
                    ? {
                        bgcolor: "#F8F9FA",
                        color: "#5F6368",
                        "&:hover": { bgcolor: "#FCE8E6", color: "#C5221F" },
                      }
                    : {
                        bgcolor: "#E6F4EA",
                        color: "#188038",
                        "&:hover": { bgcolor: "#D4EDD9" },
                      }),
                }}
              >
                {rule.is_active ? "Deactivate" : "Activate"}
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
