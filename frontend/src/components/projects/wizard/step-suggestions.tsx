"use client";

import type { ProjectPurpose } from "@/types/project";

const TYPE_ICONS: Record<string, string> = {
  video: "▶",
  poster: "◻",
  whatsapp_card: "✉",
  reel: "▶",
  story: "◻",
  infographic: "📊",
  slide_deck: "📋",
};

const TYPE_BG: Record<string, string> = {
  video: "bg-emerald-600",
  poster: "bg-violet-600",
  whatsapp_card: "bg-red-600",
  reel: "bg-emerald-600",
  story: "bg-amber-600",
  infographic: "bg-cyan-600",
  slide_deck: "bg-slate-700",
};

const AUDIENCE_LABELS: Record<string, { text: string; className: string }> = {
  internal: { text: "Internal", className: "bg-[#F7F7F7] text-[#484848]" },
  external: { text: "External", className: "bg-blue-50 text-blue-700" },
  both: { text: "Both", className: "bg-violet-50 text-violet-700" },
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

const PURPOSE_LABELS: Record<string, string> = {
  product_launch: "a product launch",
  campaign: "a campaign",
  seasonal: "a seasonal occasion",
  agent_enablement: "agent enablement",
};

export function StepSuggestions({
  purpose,
  suggestions,
  onToggle,
}: StepSuggestionsProps) {
  return (
    <div>
      <h2 className="text-[28px] font-bold text-[#222222]">
        CRAFT suggests — artifacts for {PURPOSE_LABELS[purpose] || "your project"}
      </h2>
      <p className="mt-2 text-base text-[#717171]">
        Select what you need — you can always add more later
      </p>

      <div className="mt-10 space-y-4">
        {suggestions.map((suggestion, index) => {
          const icon = TYPE_ICONS[suggestion.type] || "◻";
          const bg = TYPE_BG[suggestion.type] || "bg-violet-600";
          const audience = AUDIENCE_LABELS[suggestion.audience] || AUDIENCE_LABELS.external;

          return (
            <button
              key={index}
              onClick={() => onToggle(index)}
              className={`flex w-full items-center gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                suggestion.selected
                  ? "border-[#D0103A] bg-[#FFF0F3]"
                  : "border-[#EBEBEB] bg-white hover:border-[#DDDDDD]"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                  suggestion.selected
                    ? "bg-[#D0103A] text-white"
                    : "border-2 border-[#DDDDDD] bg-white"
                }`}
              >
                {suggestion.selected && (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Type icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${bg}`}
              >
                {icon}
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="text-base font-semibold text-[#222222]">
                  {suggestion.name}
                </p>
                <p className="mt-0.5 text-sm text-[#717171]">
                  {suggestion.description}
                </p>
              </div>

              {/* Audience badge */}
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${audience.className}`}
              >
                {audience.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
