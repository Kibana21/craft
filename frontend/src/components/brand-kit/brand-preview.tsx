"use client";

import type { BrandKit } from "@/types/brand-kit";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BrandPreviewProps {
  brandKit: BrandKit;
}

export function BrandPreview({ brandKit }: BrandPreviewProps) {
  const logoUrl = brandKit.logo_url
    ? brandKit.logo_url.startsWith("http")
      ? brandKit.logo_url
      : `${API_BASE}${brandKit.logo_url}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[#484848]">Live Preview</h3>

      {/* Poster mockup */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg"
        style={{
          background: `linear-gradient(160deg, ${brandKit.secondary_color} 0%, ${brandKit.primary_color}88 100%)`,
          aspectRatio: "9 / 16",
          maxHeight: 460,
        }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, ${brandKit.accent_color} 0%, transparent 60%)`,
          }}
        />

        {/* Logo */}
        <div className="absolute right-4 top-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Brand logo"
              className="h-8 w-auto max-w-[80px] object-contain"
            />
          ) : (
            <div
              className="flex h-8 items-center justify-center rounded px-2 text-xs font-bold text-white opacity-80"
              style={{ backgroundColor: brandKit.primary_color }}
            >
              LOGO
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          {/* Color accent bar */}
          <div
            className="mb-4 h-1 w-12 rounded-full"
            style={{ backgroundColor: brandKit.accent_color }}
          />

          {/* Headline */}
          <h2
            className="mb-2 text-xl font-bold leading-tight text-white"
            style={{ fontFamily: brandKit.fonts?.heading }}
          >
            Protect what matters most
          </h2>

          {/* Tagline */}
          <p
            className="mb-4 text-sm text-white/80"
            style={{ fontFamily: brandKit.fonts?.body }}
          >
            AIA HealthShield — comprehensive coverage for you and your family.
          </p>

          {/* CTA */}
          <div
            className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: brandKit.accent_color }}
          >
            Learn more →
          </div>

          {/* Disclaimer */}
          <p className="mt-4 text-[9px] text-white/40">
            This advertisement has not been reviewed by the Monetary Authority of Singapore.
          </p>
        </div>

        {/* Version badge */}
        <div className="absolute left-4 top-4 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white/60">
          v{brandKit.version}
        </div>
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-3">
        {[
          { label: "Primary", color: brandKit.primary_color },
          { label: "Secondary", color: brandKit.secondary_color },
          { label: "Accent", color: brandKit.accent_color },
        ].map(({ label, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className="h-8 w-8 rounded-full border border-[#DDDDDD] shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-[#717171]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
