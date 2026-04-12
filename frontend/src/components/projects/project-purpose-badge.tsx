import Box from "@mui/material/Box";

const PURPOSE_CONFIG: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  product_launch:    { icon: "🚀", label: "Product launch",    bg: "#FFF0F3", color: "#D0103A" },
  campaign:          { icon: "📣", label: "Campaign",           bg: "#FFFBEB", color: "#B45309" },
  seasonal:          { icon: "🎉", label: "Seasonal",           bg: "#F5F3FF", color: "#6D28D9" },
  agent_enablement:  { icon: "📚", label: "Agent enablement",  bg: "#EFF6FF", color: "#1D4ED8" },
};

export function ProjectPurposeBadge({ purpose }: { purpose: string }) {
  const cfg = PURPOSE_CONFIG[purpose] ?? PURPOSE_CONFIG.campaign;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        borderRadius: 9999,
        bgcolor: cfg.bg,
        color: cfg.color,
        px: 1.5,
        py: 0.5,
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <span>{cfg.icon}</span>
      {cfg.label}
    </Box>
  );
}
