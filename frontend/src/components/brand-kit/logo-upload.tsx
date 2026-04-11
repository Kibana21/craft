"use client";

import { useRef, useState } from "react";

interface LogoUploadProps {
  label: string;
  currentUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function LogoUpload({ label, currentUrl, onUpload, disabled }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const resolveUrl = (url: string) =>
    url.startsWith("http") ? url : `${API_BASE}${url}`;

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#484848]">{label}</label>

      <div
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
          isDragging
            ? "border-[#D0103A] bg-[#FFF0F3]"
            : "border-[#DDDDDD] bg-[#F7F7F7] hover:border-[#AAAAAA]"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !disabled) handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D0103A] border-t-transparent" />
            <span className="text-xs text-[#717171]">Uploading…</span>
          </div>
        ) : currentUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={resolveUrl(currentUrl)}
              alt={label}
              className="h-16 w-auto max-w-[140px] object-contain"
            />
            <span className="text-xs text-[#717171]">Click to replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-xl">
              🖼
            </div>
            <span className="text-sm font-medium text-[#484848]">Upload logo</span>
            <span className="text-xs text-[#717171]">PNG, SVG, JPG, WebP · max 10 MB</span>
          </div>
        )}
      </div>
    </div>
  );
}
