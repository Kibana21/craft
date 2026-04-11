"use client";

import type { OverviewMetrics } from "@/types/analytics";

interface OverviewMetricsProps {
  data: OverviewMetrics;
  isLoading?: boolean;
}

const METRICS = [
  {
    key: "assets_created_week" as const,
    label: "Created this week",
    icon: "✏️",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "assets_created_month" as const,
    label: "Created this month",
    icon: "📅",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "total_remixes" as const,
    label: "Total remixes",
    icon: "🔄",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "compliance_rate" as const,
    label: "Compliance rate",
    icon: "✅",
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  {
    key: "active_fscs" as const,
    label: "Active FSCs",
    icon: "👥",
    format: (v: number) => v.toLocaleString(),
  },
];

export function OverviewMetrics({ data, isLoading }: OverviewMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {METRICS.map((m) => (
        <div key={m.key} className="rounded-xl border border-[#EBEBEB] bg-white p-5">
          <div className="mb-3 text-2xl">{m.icon}</div>
          {isLoading ? (
            <div className="h-7 w-16 animate-pulse rounded bg-[#F7F7F7]" />
          ) : (
            <p className="text-2xl font-bold text-[#222222]">{m.format(data[m.key])}</p>
          )}
          <p className="mt-1 text-xs text-[#717171]">{m.label}</p>
        </div>
      ))}
    </div>
  );
}
