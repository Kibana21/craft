"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBrandKitVersions, restoreBrandKitVersion } from "@/lib/api/brand-kit";
import { queryKeys } from "@/lib/query-keys";
import { VersionCard } from "../version-card";
import type { BrandKitVersionSummary } from "@/types/brand-kit";

const HOW_IT_WORKS = [
  "One kit active at a time across the entire organisation.",
  "Restoring a past version immediately applies it to all new projects and artifact generations.",
  "Existing published artifacts retain the kit version they were generated under — no retroactive changes.",
  "Brand Admins are notified when a kit version is activated or restored.",
];

export function VersionHistoryTab() {
  const queryClient = useQueryClient();
  const [restoreTarget, setRestoreTarget] = useState<BrandKitVersionSummary | null>(null);

  const versionsQuery = useQuery({
    queryKey: queryKeys.brandKitVersions(),
    queryFn: fetchBrandKitVersions,
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => restoreBrandKitVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brandKit() });
      queryClient.invalidateQueries({ queryKey: queryKeys.brandKitVersions() });
      setRestoreTarget(null);
    },
  });

  const versions = versionsQuery.data ?? [];

  if (versionsQuery.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} sx={{ color: "#D0103A" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, gap: 4 }}>
      <Box>
        {versions.length === 0 ? (
          <Typography sx={{ fontSize: 14, color: "#5F6368" }}>No versions found.</Typography>
        ) : (
          versions.map((v) => (
            <VersionCard
              key={v.id}
              version={v}
              onRestore={(id) => {
                const target = versions.find((ver) => ver.id === id);
                if (target) setRestoreTarget(target);
              }}
              isRestoring={restoreMutation.isPending && restoreTarget?.id === v.id}
            />
          ))
        )}
      </Box>

      <Box
        sx={{
          border: "1px solid #E8EAED",
          borderRadius: "12px",
          p: 2.5,
          backgroundColor: "#F7F7F7",
          alignSelf: "flex-start",
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5 }}>
          How versioning works
        </Typography>
        {HOW_IT_WORKS.map((text, i) => (
          <Box key={i} sx={{ display: "flex", gap: 1, mb: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: "#5F6368", flexShrink: 0, lineHeight: 1.1 }}>
              {i + 1}.
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#5F6368", lineHeight: 1.5 }}>
              {text}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Restore confirmation dialog */}
      <Dialog
        open={restoreTarget !== null}
        onClose={() => !restoreMutation.isPending && setRestoreTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: 16 }}>
          Restore to v{restoreTarget?.version}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: "#5F6368" }}>
            This will apply to all new content generation. Existing published artifacts won&apos;t change.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setRestoreTarget(null)}
            disabled={restoreMutation.isPending}
            sx={{ borderRadius: 9999, textTransform: "none", color: "#5F6368" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
            disabled={restoreMutation.isPending}
            variant="contained"
            disableElevation
            startIcon={
              restoreMutation.isPending ? (
                <CircularProgress size={14} sx={{ color: "white" }} />
              ) : undefined
            }
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              fontWeight: 600,
              backgroundColor: "#D0103A",
              "&:hover": { backgroundColor: "#A00D2E" },
            }}
          >
            {restoreMutation.isPending ? "Restoring…" : "Restore"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
