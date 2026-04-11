"use client";

import type { ProjectPurpose } from "@/types/project";

const PURPOSE_OPTIONS: {
  key: ProjectPurpose;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    key: "product_launch",
    icon: "🚀",
    title: "Product launch",
    description: "New product to market — agents AND customers need content",
  },
  {
    key: "campaign",
    icon: "📣",
    title: "Campaign",
    description: "Promotional push on existing product — time-bound",
  },
  {
    key: "seasonal",
    icon: "🎉",
    title: "Seasonal / occasion",
    description: "Festive, national day, awareness month",
  },
  {
    key: "agent_enablement",
    icon: "📚",
    title: "Agent enablement",
    description: "Training, onboarding, product knowledge — internal only",
  },
];

interface StepPurposeTypeProps {
  value: ProjectPurpose | null;
  onChange: (purpose: ProjectPurpose) => void;
}

export function StepPurposeType({ value, onChange }: StepPurposeTypeProps) {
  return (
    <div>
      <h2 className="text-[28px] font-bold text-[#222222]">
        What are we launching?
      </h2>
      <p className="mt-2 text-base text-[#717171]">
        This sets the context for every artifact you'll create in this project
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6">
        {PURPOSE_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`rounded-xl border-2 p-8 text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
              value === option.key
                ? "border-[#D0103A] bg-[#FFF0F3]"
                : "border-[#EBEBEB] bg-white hover:border-[#DDDDDD]"
            }`}
          >
            <span className="text-4xl">{option.icon}</span>
            <h3
              className={`mt-4 text-base font-semibold ${
                value === option.key ? "text-[#D0103A]" : "text-[#222222]"
              }`}
            >
              {option.title}
            </h3>
            <p className="mt-1 text-sm text-[#717171]">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
