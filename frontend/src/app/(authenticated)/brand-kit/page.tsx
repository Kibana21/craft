"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { ColoursTab } from "@/components/brand-kit/tabs/colours-tab";
import { TypographyTab } from "@/components/brand-kit/tabs/typography-tab";
import { LogoVaultTab } from "@/components/brand-kit/tabs/logo-vault-tab";
import { TemplatesTab } from "@/components/brand-kit/tabs/templates-tab";
import { LivePreviewTab } from "@/components/brand-kit/tabs/live-preview-tab";
import { VersionHistoryTab } from "@/components/brand-kit/tabs/version-history-tab";
import {
  fetchBrandKit,
  updateBrandKit,
  uploadFont,
  uploadLogo,
} from "@/lib/api/brand-kit";
import { queryKeys } from "@/lib/query-keys";
import type { BrandKit, ColorNames, ZoneRoles, ZoneColorRole } from "@/types/brand-kit";

const TABS = [
  { key: "colours", label: "Colours" },
  { key: "typography", label: "Typography" },
  { key: "logo-vault", label: "Logos" },
  { key: "templates", label: "Templates" },
  { key: "live-preview", label: "Live Preview" },
  { key: "version-history", label: "Version History" },
];

export default function BrandKitPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "brand_admin";
  const activeTab = searchParams.get("tab") || "colours";
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);

  const kitQuery = useQuery({
    queryKey: queryKeys.brandKit(),
    queryFn: fetchBrandKit,
    // Backend may be mid-restart (uvicorn --reload). Retry more aggressively
    // so transient startup failures are invisible; only extended outages
    // surface the manual Retry button.
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    // Auto-retry every 8 s while in error state so the page self-heals once
    // the backend is ready, without needing a manual Retry click.
    refetchInterval: (query) =>
      query.state.status === "error" && !query.state.data ? 8000 : false,
  });

  const kit = kitQuery.data;

  const DEFAULT_ZONE_ROLES: ZoneRoles = {
    poster_background: "primary",
    cta_fill: "primary",
    disclaimer_strip: "secondary",
    badge_callout: "accent",
    headline_text: "white",
  };

  const [draftColors, setDraftColors] = useState({ primary: "", secondary: "", accent: "" });
  const [draftColorNames, setDraftColorNames] = useState<ColorNames>({});
  const [draftZoneRoles, setDraftZoneRoles] = useState<ZoneRoles>(DEFAULT_ZONE_ROLES);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kit) {
      setDraftColors({
        primary: kit.primary_color,
        secondary: kit.secondary_color,
        accent: kit.accent_color,
      });
      setDraftColorNames(kit.color_names || {});
      setDraftZoneRoles({ ...DEFAULT_ZONE_ROLES, ...(kit.zone_roles || {}) });
    }
  }, [kit]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasChanges =
    kit != null &&
    (draftColors.primary !== kit.primary_color ||
      draftColors.secondary !== kit.secondary_color ||
      draftColors.accent !== kit.accent_color ||
      JSON.stringify(draftColorNames) !== JSON.stringify(kit.color_names || {}) ||
      JSON.stringify(draftZoneRoles) !== JSON.stringify({ ...DEFAULT_ZONE_ROLES, ...(kit.zone_roles || {}) }));

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateBrandKit({
        primary_color: draftColors.primary,
        secondary_color: draftColors.secondary,
        accent_color: draftColors.accent,
        color_names: draftColorNames,
        zone_roles: draftZoneRoles,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brandKit() });
      setError(null);
    },
    onError: () => setError("Failed to save changes"),
  });

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    router.push(`/brand-kit?tab=${TABS[newIndex].key}`, { scroll: false });
  };

  const handleDiscardChanges = () => {
    if (kit) {
      setDraftColors({
        primary: kit.primary_color,
        secondary: kit.secondary_color,
        accent: kit.accent_color,
      });
      setDraftColorNames(kit.color_names || {});
      setDraftZoneRoles({ ...DEFAULT_ZONE_ROLES, ...(kit.zone_roles || {}) });
    }
    setError(null);
  };

  const handleZoneRoleChange = useCallback((zone: keyof ZoneRoles, role: ZoneColorRole) => {
    setDraftZoneRoles((prev) => ({ ...prev, [zone]: role }));
  }, []);

  const handleColorChange = useCallback((role: "primary" | "secondary" | "accent", hex: string) => {
    setDraftColors((prev) => ({ ...prev, [role]: hex }));
  }, []);

  const handleColorNameChange = useCallback((field: keyof ColorNames, value: string) => {
    setDraftColorNames((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleLogoUpload = async (file: File, variant: "primary" | "secondary") => {
    setError(null);
    try {
      await uploadLogo(file, variant);
      queryClient.invalidateQueries({ queryKey: queryKeys.brandKit() });
    } catch {
      setError("Failed to upload logo");
    }
  };

  const handleFontUpload = async (file: File, slot: "heading" | "body" | "disclaimer") => {
    setError(null);
    try {
      await uploadFont(file, slot);
      queryClient.invalidateQueries({ queryKey: queryKeys.brandKit() });
    } catch {
      setError("Failed to upload font");
    }
  };

  const previewKit: BrandKit | null = kit
    ? {
        ...kit,
        primary_color: draftColors.primary || kit.primary_color,
        secondary_color: draftColors.secondary || kit.secondary_color,
        accent_color: draftColors.accent || kit.accent_color,
        color_names: draftColorNames,
      }
    : null;

  if (kitQuery.isPending) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4, display: "flex", justifyContent: "center", pt: 12 }}>
        <CircularProgress size={32} sx={{ color: "#D0103A" }} />
      </Box>
    );
  }

  if (!kit || !previewKit) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
        <Typography sx={{ fontSize: 14, color: "#717171", mb: 1.5 }}>
          {kitQuery.isError ? "Could not load brand kit." : "Brand kit not available."}
        </Typography>
        {kitQuery.isError && (
          <Button
            onClick={() => kitQuery.refetch()}
            variant="outlined"
            disableElevation
            sx={{ borderRadius: 9999, textTransform: "none", fontSize: 13, borderColor: "#E8EAED", color: "#1F1F1F" }}
          >
            {kitQuery.isFetching ? "Retrying…" : "Retry"}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, color: "#1F1F1F" }}>
              Brand Kit
            </Typography>
            <Box
              sx={{
                px: 1.25,
                py: 0.25,
                borderRadius: 9999,
                backgroundColor: "#E8F5E9",
                fontSize: 12,
                fontWeight: 600,
                color: "#188038",
              }}
            >
              Active
            </Box>
          </Box>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: "#5F6368" }}>
            {kit.name} · v{kit.version}
            {kit.activated_by_info && ` · Last updated by ${kit.activated_by_info.name}`}
            {kit.activated_at &&
              `, ${new Date(kit.activated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
          </Typography>
        </Box>

        {isAdmin && hasChanges && (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <Typography sx={{ fontSize: 13, color: "#5F6368" }}>Unsaved changes</Typography>
            <Button
              onClick={handleDiscardChanges}
              variant="outlined"
              disableElevation
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                fontSize: 14,
                borderColor: "#E8EAED",
                color: "#5F6368",
                "&:hover": { borderColor: "#DADCE0", backgroundColor: "transparent" },
              }}
            >
              Discard
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              disableElevation
              variant="contained"
              startIcon={
                saveMutation.isPending ? (
                  <CircularProgress size={14} sx={{ color: "white" }} />
                ) : undefined
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: "#1F1F1F",
                "&:hover": { backgroundColor: "#333" },
                "&:disabled": { opacity: 0.4 },
              }}
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Box
          sx={{
            mb: 3,
            borderRadius: "12px",
            backgroundColor: "#FFF0F3",
            px: 2,
            py: 1.5,
            fontSize: 14,
            color: "#D0103A",
          }}
        >
          {error}
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={activeIndex === -1 ? 0 : activeIndex}
        onChange={handleTabChange}
        sx={{ mb: 4 }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} label={t.label} disableRipple />
        ))}
      </Tabs>

      {/* Tab panels */}
      {activeTab === "colours" && (
        <ColoursTab
          kit={previewKit}
          draftColors={draftColors}
          draftColorNames={draftColorNames}
          draftZoneRoles={draftZoneRoles}
          isAdmin={isAdmin}
          onColorChange={handleColorChange}
          onColorNameChange={handleColorNameChange}
          onZoneRoleChange={handleZoneRoleChange}
        />
      )}
      {activeTab === "typography" && (
        <TypographyTab
          kit={kit}
          isAdmin={isAdmin}
          onFontUpload={handleFontUpload}
        />
      )}
      {activeTab === "logo-vault" && (
        <LogoVaultTab
          kit={kit}
          isAdmin={isAdmin}
          onLogoUpload={handleLogoUpload}
        />
      )}
      {activeTab === "templates" && <TemplatesTab isAdmin={isAdmin} />}
      {activeTab === "live-preview" && <LivePreviewTab kit={previewKit} />}
      {activeTab === "version-history" && <VersionHistoryTab />}
    </Box>
  );
}
