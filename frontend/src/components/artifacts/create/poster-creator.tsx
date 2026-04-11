"use client";

import { useState } from "react";
import { ToneSelector } from "../tone-selector";
import { FormatSelector } from "../format-selector";
import { TaglineGenerator } from "../tagline-generator";

interface PosterCreatorProps {
  product: string;
  audience: string;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function PosterCreator({ product, audience, onSave, isSaving }: PosterCreatorProps) {
  const [headline, setHeadline] = useState("");
  const [tone, setTone] = useState("professional");
  const [format, setFormat] = useState("1:1");

  const handleSave = () => {
    onSave({
      headline,
      product,
      tone,
      format,
      type: "poster",
    });
  };

  return (
    <div className="space-y-6">
      <TaglineGenerator
        product={product}
        audience={audience}
        tone={tone}
        value={headline}
        onChange={setHeadline}
      />

      <ToneSelector value={tone} onChange={setTone} />

      <FormatSelector
        value={format}
        onChange={setFormat}
        options={["1:1", "4:5", "9:16"]}
      />

      {/* Preview placeholder */}
      <div className="overflow-hidden rounded-xl border border-[#EBEBEB] bg-gradient-to-br from-red-600 to-red-500">
        <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-60">
            Preview
          </p>
          <p className="mt-4 text-xl font-bold">
            {headline || "Your headline here"}
          </p>
          <p className="mt-2 text-sm opacity-70">{product}</p>
          <div className="mt-4 flex gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs">
              {tone}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs">
              {format}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || !headline.trim()}
        className="w-full rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "Creating artifact..." : "Create poster"}
      </button>
    </div>
  );
}
