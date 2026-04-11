"use client";

import { useState } from "react";
import { generateTaglines } from "@/lib/api/ai";

interface TaglineGeneratorProps {
  product: string;
  audience: string;
  tone: string;
  value: string;
  onChange: (tagline: string) => void;
}

export function TaglineGenerator({
  product,
  audience,
  tone,
  value,
  onChange,
}: TaglineGeneratorProps) {
  const [taglines, setTaglines] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const results = await generateTaglines(product, audience, tone);
      setTaglines(results);
    } catch {
      // Fallback handled by backend
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-[#484848]">
          Headline / Tagline
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-[#F7F7F7] px-3 py-1.5 text-xs font-semibold text-[#484848] transition-all hover:bg-[#EBEBEB] disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "✨ Generate taglines"}
        </button>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a headline or generate with AI"
        className="mb-3 w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] focus:border-[#222222] focus:outline-none focus:ring-0"
      />

      {taglines.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {taglines.map((tagline, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(tagline)}
              className={`rounded-full px-4 py-2 text-sm transition-all duration-200 ${
                value === tagline
                  ? "bg-[#222222] text-white"
                  : "border border-[#DDDDDD] bg-white text-[#484848] hover:border-[#222222]"
              }`}
            >
              {tagline}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
