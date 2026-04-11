"use client";

const QUICK_CREATE_OPTIONS = [
  { label: "◻ Poster", type: "poster" },
  { label: "✉ WhatsApp", type: "whatsapp_card" },
  { label: "▶ Reel", type: "reel" },
  { label: "📋 Card", type: "story" },
];

export function QuickCreateStrip() {
  return (
    <div className="border-t border-[#F9C6D0] bg-[#FFF0F3] px-4 py-3">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[#D0103A]">
        Quick create
      </p>
      <div className="flex gap-2">
        {QUICK_CREATE_OPTIONS.map((option) => (
          <button
            key={option.type}
            className="flex-1 rounded-md bg-[#D0103A] px-2 py-2 text-center text-[9px] font-semibold text-white transition-colors hover:bg-[#A50C2E]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
