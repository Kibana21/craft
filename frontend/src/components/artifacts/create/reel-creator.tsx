"use client";

import { useState } from "react";
import { ToneSelector } from "../tone-selector";
import { generateStoryboard } from "@/lib/api/ai";
import type { StoryboardFrame } from "@/types/ai";

interface ReelCreatorProps {
  product: string;
  audience: string;
  keyMessage: string;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function ReelCreator({ product, audience, keyMessage, onSave, isSaving }: ReelCreatorProps) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("inspirational");
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFrame, setActiveFrame] = useState(0);

  const handleGenerateStoryboard = async () => {
    setIsGenerating(true);
    try {
      const result = await generateStoryboard(
        topic || product,
        keyMessage || "Protect what matters",
        product,
        tone
      );
      setFrames(result.frames);
    } catch {
      // Fallback handled
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    onSave({
      topic,
      product,
      tone,
      frames,
      format: "9:16",
      type: "reel",
    });
  };

  const FRAME_COLORS = [
    "from-red-600 to-rose-500",
    "from-violet-600 to-purple-500",
    "from-emerald-600 to-teal-500",
    "from-amber-600 to-orange-500",
    "from-cyan-600 to-blue-500",
    "from-slate-700 to-slate-600",
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-[#484848]">
          Topic
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Family protection, Health coverage"
          className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] focus:border-[#222222] focus:outline-none focus:ring-0"
        />
      </div>

      <ToneSelector value={tone} onChange={setTone} />

      <button
        type="button"
        onClick={handleGenerateStoryboard}
        disabled={isGenerating}
        className="w-full rounded-lg bg-[#222222] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#484848] disabled:opacity-50"
      >
        {isGenerating ? "Generating storyboard..." : "✨ Generate storyboard"}
      </button>

      {/* Storyboard preview */}
      {frames.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#484848]">
            Storyboard — {frames.length} frames
          </h3>

          {/* Frame timeline */}
          <div className="mb-4 flex gap-2">
            {frames.map((frame, i) => (
              <button
                key={i}
                onClick={() => setActiveFrame(i)}
                className={`flex-1 rounded-lg p-2 text-center text-xs transition-all ${
                  i === activeFrame
                    ? "bg-[#222222] text-white"
                    : "bg-[#F7F7F7] text-[#717171] hover:bg-[#EBEBEB]"
                }`}
              >
                {frame.duration_seconds}s
              </button>
            ))}
          </div>

          {/* Active frame preview */}
          <div
            className={`overflow-hidden rounded-xl bg-gradient-to-br ${FRAME_COLORS[activeFrame % FRAME_COLORS.length]}`}
          >
            <div className="flex aspect-[9/16] max-h-80 flex-col items-center justify-center p-8 text-center text-white">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-60">
                Frame {frames[activeFrame].frame_number} · {frames[activeFrame].transition}
              </p>
              <p className="mt-4 text-2xl font-bold">
                {frames[activeFrame].text_overlay}
              </p>
              <p className="mt-3 text-sm opacity-70">
                {frames[activeFrame].visual_description}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving || frames.length === 0}
        className="w-full rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "Creating reel..." : "Create reel"}
      </button>
    </div>
  );
}
