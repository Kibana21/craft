"use client";

const TONES = [
  { key: "professional", label: "Professional", icon: "💼" },
  { key: "friendly", label: "Friendly", icon: "😊" },
  { key: "urgent", label: "Urgent", icon: "⚡" },
  { key: "inspirational", label: "Inspirational", icon: "✨" },
  { key: "festive", label: "Festive", icon: "🎉" },
];

interface ToneSelectorProps {
  value: string;
  onChange: (tone: string) => void;
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#484848]">
        Tone
      </label>
      <div className="flex flex-wrap gap-2">
        {TONES.map((tone) => (
          <button
            key={tone.key}
            type="button"
            onClick={() => onChange(tone.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              value === tone.key
                ? "bg-[#222222] text-white"
                : "border border-[#DDDDDD] bg-white text-[#484848] hover:border-[#222222]"
            }`}
          >
            {tone.icon} {tone.label}
          </button>
        ))}
      </div>
    </div>
  );
}
