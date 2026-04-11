"use client";

interface AnalyticsFiltersProps {
  period: "week" | "month" | "quarter";
  onPeriodChange: (p: "week" | "month" | "quarter") => void;
}

const PERIODS = [
  { value: "week" as const, label: "7 days" },
  { value: "month" as const, label: "30 days" },
  { value: "quarter" as const, label: "90 days" },
];

export function AnalyticsFilters({ period, onPeriodChange }: AnalyticsFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#717171]">Period:</span>
      <div className="flex rounded-lg border border-[#DDDDDD] bg-white overflow-hidden">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === p.value
                ? "bg-[#222222] text-white"
                : "text-[#484848] hover:bg-[#F7F7F7]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
