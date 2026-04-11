"use client";

import type { ProjectPurpose } from "@/types/project";

const TYPE_ICONS: Record<string, string> = {
  video:         "▶",
  poster:        "◻",
  whatsapp_card: "✉",
  reel:          "▶",
  story:         "◻",
  infographic:   "📊",
  slide_deck:    "📋",
};

const TYPE_BG: Record<string, string> = {
  video:         "bg-emerald-600",
  poster:        "bg-violet-600",
  whatsapp_card: "bg-red-600",
  reel:          "bg-emerald-600",
  story:         "bg-amber-600",
  infographic:   "bg-cyan-600",
  slide_deck:    "bg-slate-700",
};

const AUDIENCE_LABELS: Record<string, { text: string; className: string }> = {
  internal: { text: "Internal", className: "bg-[#F1F3F4] text-[#5F6368]" },
  external: { text: "External", className: "bg-blue-50 text-blue-700" },
  both:     { text: "Both",     className: "bg-violet-50 text-violet-700" },
};

const PURPOSE_LABELS: Record<string, string> = {
  product_launch:   "a product launch",
  campaign:         "a campaign",
  seasonal:         "a seasonal occasion",
  agent_enablement: "agent enablement",
};

interface Suggestion {
  type: string;
  name: string;
  description: string;
  audience: string;
  selected: boolean;
}

interface StepSuggestionsProps {
  purpose: ProjectPurpose;
  suggestions: Suggestion[];
  onToggle: (index: number) => void;
}

export function StepSuggestions({ purpose, suggestions, onToggle }: StepSuggestionsProps) {
  const selectedCount = suggestions.filter((s) => s.selected).length;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-[#1F1F1F]">
            CRAFT suggests
          </h2>
          <p className="mt-0.5 text-[13px] text-[#80868B]">
            Artifacts for {PURPOSE_LABELS[purpose] || "your project"} · select what you need
          </p>
        </div>
        <span className="shrink-0 text-[13px] font-medium text-[#5F6368]">
          {selectedCount} of {suggestions.length} selected
        </span>
      </div>

      <div className="space-y-1.5">
        {suggestions.map((suggestion, index) => {
          const icon     = TYPE_ICONS[suggestion.type] || "◻";
          const bg       = TYPE_BG[suggestion.type] || "bg-violet-600";
          const audience = AUDIENCE_LABELS[suggestion.audience] || AUDIENCE_LABELS.external;

          return (
            <button
              key={index}
              onClick={() => onToggle(index)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                suggestion.selected
                  ? "border-[#D0103A] bg-[#FFF8F9]"
                  : "border-[#E8EAED] bg-white hover:border-[#DADCE0] hover:bg-[#F8F9FA]"
              }`}
            >
              {/* Checkbox */}
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
                suggestion.selected ? "bg-[#D0103A] text-white" : "border border-[#DADCE0] bg-white"
              }`}>
                {suggestion.selected && (
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Type icon */}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white ${bg}`}>
                {icon}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#1F1F1F]">{suggestion.name}</p>
                <p className="truncate text-[12px] text-[#80868B]">{suggestion.description}</p>
              </div>

              {/* Audience badge */}
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${audience.className}`}>
                {audience.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
