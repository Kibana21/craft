"use client";

import type { ExportAspectRatio, ExportFormat } from "@/types/export";

interface ExportOption {
  format: ExportFormat;
  aspectRatio?: ExportAspectRatio;
  label: string;
  description: string;
  icon: string;
}

const POSTER_OPTIONS: ExportOption[] = [
  { format: "png", aspectRatio: "1:1", label: "Square PNG", description: "1080 × 1080 px", icon: "◻" },
  { format: "png", aspectRatio: "4:5", label: "Portrait PNG", description: "1080 × 1350 px", icon: "▭" },
  { format: "png", aspectRatio: "9:16", label: "Story PNG", description: "1080 × 1920 px", icon: "📱" },
  { format: "jpg", aspectRatio: "1:1", label: "Square JPG", description: "1080 × 1080 px · smaller file", icon: "◻" },
  { format: "jpg", aspectRatio: "4:5", label: "Portrait JPG", description: "1080 × 1350 px · smaller file", icon: "▭" },
];

const WHATSAPP_OPTIONS: ExportOption[] = [
  { format: "png", aspectRatio: "800x800", label: "WhatsApp Card", description: "800 × 800 px PNG", icon: "💬" },
];

const REEL_OPTIONS: ExportOption[] = [
  { format: "mp4", aspectRatio: "9:16", label: "Reel MP4", description: "1080 × 1920 · H.264 · 30fps", icon: "🎬" },
];

type ArtifactType = "poster" | "whatsapp_card" | "reel" | string;

interface ExportFormatOptionsProps {
  artifactType: ArtifactType;
  selected: { format: ExportFormat; aspectRatio?: ExportAspectRatio } | null;
  onSelect: (format: ExportFormat, aspectRatio?: ExportAspectRatio) => void;
}

function getOptions(artifactType: ArtifactType): ExportOption[] {
  if (artifactType === "whatsapp_card") return WHATSAPP_OPTIONS;
  if (artifactType === "reel") return REEL_OPTIONS;
  return POSTER_OPTIONS;
}

export function ExportFormatOptions({ artifactType, selected, onSelect }: ExportFormatOptionsProps) {
  const options = getOptions(artifactType);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const isSelected =
          selected?.format === opt.format && selected?.aspectRatio === opt.aspectRatio;
        return (
          <button
            key={`${opt.format}-${opt.aspectRatio}`}
            type="button"
            onClick={() => onSelect(opt.format, opt.aspectRatio)}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              isSelected
                ? "border-[#D0103A] bg-[#FFF0F3] shadow-sm"
                : "border-[#DDDDDD] bg-white hover:border-[#AAAAAA]"
            }`}
          >
            <span className="text-2xl">{opt.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${isSelected ? "text-[#D0103A]" : "text-[#222222]"}`}>
                {opt.label}
              </p>
              <p className="text-xs text-[#717171]">{opt.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
