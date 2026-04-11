"use client";

import { useState } from "react";
import { ToneSelector } from "../tone-selector";
import { TaglineGenerator } from "../tagline-generator";

interface WhatsAppCreatorProps {
  product: string;
  audience: string;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function WhatsAppCreator({ product, audience, onSave, isSaving }: WhatsAppCreatorProps) {
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("friendly");

  const handleSave = () => {
    onSave({
      headline,
      message,
      product,
      tone,
      format: "800x800",
      type: "whatsapp_card",
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

      <div>
        <label className="mb-2 block text-sm font-medium text-[#484848]">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your WhatsApp message..."
          rows={3}
          className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] focus:border-[#222222] focus:outline-none focus:ring-0"
        />
      </div>

      <ToneSelector value={tone} onChange={setTone} />

      {/* WhatsApp card preview */}
      <div className="mx-auto w-64 overflow-hidden rounded-xl border border-[#EBEBEB] bg-white">
        <div className="flex h-48 items-center justify-center bg-gradient-to-br from-red-600 to-rose-500 p-6 text-center">
          <p className="text-lg font-bold text-white">
            {headline || "Your headline"}
          </p>
        </div>
        <div className="p-4">
          <p className="text-sm text-[#484848]">
            {message || "Your message here..."}
          </p>
          <p className="mt-2 text-xs text-[#B0B0B0]">{product} · AIA Singapore</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || !headline.trim()}
        className="w-full rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "Creating card..." : "Create WhatsApp card"}
      </button>
    </div>
  );
}
