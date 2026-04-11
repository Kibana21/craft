const PURPOSE_CONFIG: Record<string, { icon: string; label: string; className: string }> = {
  product_launch: { icon: "🚀", label: "Product launch", className: "bg-[#FFF0F3] text-[#D0103A]" },
  campaign: { icon: "📣", label: "Campaign", className: "bg-amber-50 text-amber-700" },
  seasonal: { icon: "🎉", label: "Seasonal", className: "bg-violet-50 text-violet-700" },
  agent_enablement: { icon: "📚", label: "Agent enablement", className: "bg-blue-50 text-blue-700" },
};

export function ProjectPurposeBadge({ purpose }: { purpose: string }) {
  const config = PURPOSE_CONFIG[purpose] || PURPOSE_CONFIG.campaign;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}
