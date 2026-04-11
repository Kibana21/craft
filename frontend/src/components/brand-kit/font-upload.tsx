"use client";

import { useRef, useState } from "react";

interface FontUploadProps {
  slot: "heading" | "body" | "accent";
  currentFontName: string | undefined;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const SLOT_LABELS: Record<string, string> = {
  heading: "Heading font",
  body: "Body font",
  accent: "Accent font",
};

const SAMPLE_SIZES: Record<string, string> = {
  heading: "text-2xl font-bold",
  body: "text-base",
  accent: "text-sm italic",
};

export function FontUpload({ slot, currentFontName, onUpload, disabled }: FontUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-[#DDDDDD] bg-white p-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#AAAAAA]">
          {SLOT_LABELS[slot]}
        </span>
        {currentFontName ? (
          <span className={`text-[#222222] ${SAMPLE_SIZES[slot]}`}>
            {currentFontName.replace(/\.[^.]+$/, "")}
          </span>
        ) : (
          <span className="text-sm text-[#AAAAAA]">No font uploaded</span>
        )}
        <span className="mt-0.5 text-xs text-[#717171]">
          The quick brown fox jumps over the lazy dog
        </span>
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="rounded-lg border border-[#DDDDDD] bg-white px-4 py-2 text-sm font-medium text-[#484848] transition-all hover:border-[#222222] hover:text-[#222222] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : currentFontName ? "Replace" : "Upload"}
        </button>
      </div>
    </div>
  );
}
