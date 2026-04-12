"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExportFormatOptions } from "./export-format-options";
import { checkExportStatus, exportArtifact, getDownloadUrl } from "@/lib/api/exports";
import type { ExportAspectRatio, ExportFormat, ExportStatus } from "@/types/export";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";

interface ExportDialogProps {
  artifactId: string;
  artifactType: string;
  artifactName: string;
  complianceScore: number | null;
  onClose: () => void;
}

const MIN_COMPLIANCE = 70;

export function ExportDialog({
  artifactId,
  artifactType,
  artifactName,
  complianceScore,
  onClose,
}: ExportDialogProps) {
  const [selected, setSelected] = useState<{
    format: ExportFormat;
    aspectRatio?: ExportAspectRatio;
  } | null>(null);
  const [phase, setPhase] = useState<"select" | "processing" | "ready" | "failed">("select");
  const [exportId, setExportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlocked = complianceScore === null || complianceScore < MIN_COMPLIANCE;

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  async function handleExport() {
    if (!selected) return;
    setPhase("processing");

    try {
      const res = await exportArtifact(artifactId, selected.format, selected.aspectRatio);
      setExportId(res.export_id);

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await checkExportStatus(res.export_id);
          if (statusRes.status === "ready") {
            stopPoll();
            setDownloadUrl(getDownloadUrl(res.export_id));
            setPhase("ready");
          } else if (statusRes.status === "failed") {
            stopPoll();
            setPhase("failed");
          }
        } catch {
          stopPoll();
          setPhase("failed");
        }
      }, 2000);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Export failed";
      setPhase("failed");
    }
  }

  function handleDownload() {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #EBEBEB",
          px: 3,
          py: 2.5,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#222222" }}>
            Export
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              fontSize: "0.875rem",
              color: "#717171",
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {artifactName}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "#717171",
            "&:hover": { bgcolor: "#F7F7F7", color: "#222222" },
          }}
        >
          ✕
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {/* Compliance gate */}
        {isBlocked && (
          <Box
            sx={{
              mb: 2.5,
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              borderRadius: "12px",
              bgcolor: "#FFF8E6",
              p: 2,
            }}
          >
            <Box component="span" sx={{ fontSize: "1.125rem" }}>⚠️</Box>
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#B8860B" }}>
                Compliance check required
              </Typography>
              <Typography sx={{ mt: 0.25, fontSize: "0.75rem", color: "#B8860B" }}>
                {complianceScore === null
                  ? "This artifact has not been scored yet. Run compliance check first."
                  : `Score is ${complianceScore.toFixed(0)}/100 — minimum ${MIN_COMPLIANCE} required to export.`}
              </Typography>
            </Box>
          </Box>
        )}

        {phase === "select" && (
          <>
            <Typography sx={{ mb: 2, fontSize: "0.875rem", color: "#484848" }}>
              Select export format:
            </Typography>
            <ExportFormatOptions
              artifactType={artifactType}
              selected={selected}
              onSelect={(format, aspectRatio) => setSelected({ format, aspectRatio })}
            />
          </>
        )}

        {phase === "processing" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 3,
            }}
          >
            <Box
              sx={{
                height: 40,
                width: 40,
                borderRadius: "50%",
                border: "3px solid #DDDDDD",
                borderTopColor: "#D0103A",
                animation: "spin 0.8s linear infinite",
                "@keyframes spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
              }}
            />
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#222222" }}>
                Rendering your export…
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#717171" }}>
                {selected?.format === "mp4"
                  ? "Reel rendering takes 10–30 seconds"
                  : "Poster rendering takes 2–5 seconds"}
              </Typography>
            </Box>
          </Box>
        )}

        {phase === "ready" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                height: 48,
                width: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                bgcolor: "#E6F4EA",
                fontSize: "1.5rem",
              }}
            >
              ✅
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#222222" }}>
                Export ready!
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#717171" }}>
                Your file is ready to download.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={handleDownload}
              disableElevation
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                bgcolor: "#D0103A",
                color: "white",
                fontWeight: 600,
                fontSize: "0.875rem",
                px: 3,
                py: 1.5,
                "&:hover": { bgcolor: "#B80E33" },
                "&:active": { transform: "scale(0.95)" },
              }}
            >
              Download file
            </Button>
          </Box>
        )}

        {phase === "failed" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                height: 48,
                width: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                bgcolor: "#FFF0F3",
                fontSize: "1.5rem",
              }}
            >
              ❌
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#222222" }}>
                Export failed
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#717171" }}>
                Something went wrong. Please try again.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => setPhase("select")}
              disableElevation
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#DDDDDD",
                color: "#484848",
                fontWeight: 500,
                fontSize: "0.875rem",
                px: 3,
                py: 1.25,
                "&:hover": { borderColor: "#222222", bgcolor: "transparent" },
              }}
            >
              Try again
            </Button>
          </Box>
        )}
      </DialogContent>

      {/* Footer */}
      {phase === "select" && (
        <DialogActions
          sx={{
            borderTop: "1px solid #EBEBEB",
            px: 3,
            py: 2,
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            onClick={onClose}
            disableElevation
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#DDDDDD",
              color: "#484848",
              fontWeight: 500,
              fontSize: "0.875rem",
              px: 2.5,
              py: 1.25,
              "&:hover": { borderColor: "#222222", bgcolor: "transparent" },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={!selected || isBlocked}
            disableElevation
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "white",
              fontWeight: 600,
              fontSize: "0.875rem",
              px: 3,
              py: 1.25,
              "&:hover": { bgcolor: "#B80E33" },
              "&:active": { transform: "scale(0.95)" },
              "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
            }}
          >
            Export
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
