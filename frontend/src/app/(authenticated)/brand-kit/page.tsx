"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { BrandPreview } from "@/components/brand-kit/brand-preview";
import { ColorPicker } from "@/components/brand-kit/color-picker";
import { FontUpload } from "@/components/brand-kit/font-upload";
import { LogoUpload } from "@/components/brand-kit/logo-upload";
import {
  fetchBrandKit,
  updateBrandKit,
  uploadFont,
  uploadLogo,
} from "@/lib/api/brand-kit";
import type { BrandKit } from "@/types/brand-kit";

export default function BrandKitPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [kit, setKit] = useState<BrandKit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local edits (colors only — logos/fonts save immediately on upload)
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    fetchBrandKit()
      .then((data) => {
        setKit(data);
        setPrimaryColor(data.primary_color);
        setSecondaryColor(data.secondary_color);
        setAccentColor(data.accent_color);
      })
      .catch(() => setError("Failed to load brand kit"))
      .finally(() => setIsLoading(false));
  }, []);

  // Live preview — merge local edits into kit object
  const previewKit: BrandKit | null = kit
    ? {
        ...kit,
        primary_color: primaryColor || kit.primary_color,
        secondary_color: secondaryColor || kit.secondary_color,
        accent_color: accentColor || kit.accent_color,
      }
    : null;

  const hasColorChanges =
    kit &&
    (primaryColor !== kit.primary_color ||
      secondaryColor !== kit.secondary_color ||
      accentColor !== kit.accent_color);

  async function handleSaveColors() {
    if (!hasColorChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateBrandKit({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
      });
      setKit(updated);
      setSavedAt(new Date());
    } catch {
      setError("Failed to save colors");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoUpload(file: File, variant: "primary" | "secondary") {
    setError(null);
    try {
      const updated = await uploadLogo(file, variant);
      setKit(updated);
      setSavedAt(new Date());
    } catch {
      setError("Failed to upload logo");
    }
  }

  async function handleFontUpload(file: File, slot: "heading" | "body" | "accent") {
    setError(null);
    try {
      const updated = await uploadFont(file, slot);
      setKit(updated);
      setSavedAt(new Date());
    } catch {
      setError("Failed to upload font");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F7F7F7]" />
          ))}
        </div>
      </div>
    );
  }

  if (!kit || !previewKit) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <p className="text-sm text-[#717171]">Brand kit not available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#222222]">Brand Kit</h1>
          <p className="mt-1 text-base text-[#717171]">
            {isAdmin
              ? "Manage AIA brand assets — logos, colors, and typography"
              : "View the current AIA brand kit used across all content"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-xs text-[#717171]">
            Version {kit.version}
          </span>
          {savedAt && (
            <span className="text-xs text-[#1B9D74]">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-[#FFF0F3] px-4 py-3 text-sm text-[#D0103A]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        {/* Left: settings */}
        <div className="space-y-10">
          {/* Logos */}
          <section>
            <h2 className="mb-5 text-base font-semibold text-[#222222]">Logos</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <LogoUpload
                label="Primary logo"
                currentUrl={kit.logo_url}
                onUpload={(file) => handleLogoUpload(file, "primary")}
                disabled={!isAdmin}
              />
              <LogoUpload
                label="Secondary logo (optional)"
                currentUrl={kit.secondary_logo_url}
                onUpload={(file) => handleLogoUpload(file, "secondary")}
                disabled={!isAdmin}
              />
            </div>
          </section>

          {/* Colors */}
          <section>
            <h2 className="mb-5 text-base font-semibold text-[#222222]">Brand colors</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <ColorPicker
                label="Primary"
                value={primaryColor}
                onChange={setPrimaryColor}
                disabled={!isAdmin}
              />
              <ColorPicker
                label="Secondary"
                value={secondaryColor}
                onChange={setSecondaryColor}
                disabled={!isAdmin}
              />
              <ColorPicker
                label="Accent"
                value={accentColor}
                onChange={setAccentColor}
                disabled={!isAdmin}
              />
            </div>
            {isAdmin && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveColors}
                  disabled={!hasColorChanges || isSaving}
                  className="rounded-xl bg-[#D0103A] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving ? "Saving…" : "Save colors"}
                </button>
                {hasColorChanges && (
                  <button
                    onClick={() => {
                      setPrimaryColor(kit.primary_color);
                      setSecondaryColor(kit.secondary_color);
                      setAccentColor(kit.accent_color);
                    }}
                    className="text-sm text-[#717171] hover:text-[#222222]"
                  >
                    Discard changes
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Fonts */}
          <section>
            <h2 className="mb-5 text-base font-semibold text-[#222222]">Typography</h2>
            <div className="space-y-3">
              {(["heading", "body", "accent"] as const).map((slot) => (
                <FontUpload
                  key={slot}
                  slot={slot}
                  currentFontName={kit.fonts?.[slot]}
                  onUpload={(file) => handleFontUpload(file, slot)}
                  disabled={!isAdmin}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right: live preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BrandPreview brandKit={previewKit} />
        </div>
      </div>
    </div>
  );
}
