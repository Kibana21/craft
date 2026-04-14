"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { deleteImage, getImage, staticStudioUrl } from "@/lib/api/studio";
import {
  STUDIO_IMAGE_TYPE_COLOR,
  STUDIO_IMAGE_TYPE_LABEL,
  type StudioImageDetail,
} from "@/types/studio";

export default function StudioImageDetailPage() {
  const { imageId } = useParams<{ imageId: string }>();
  const router = useRouter();

  const [image, setImage] = useState<StudioImageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const refresh = useCallback(async () => {
    if (!imageId) return;
    setIsLoading(true);
    try {
      setImage(await getImage(imageId));
    } catch {
      setError("Could not load this image.");
    } finally {
      setIsLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDownload = () => {
    if (!image) return;
    window.open(staticStudioUrl(image.storage_url), "_blank", "noopener,noreferrer");
  };

  const handleEnhanceFurther = () => {
    if (!image) return;
    router.push(`/my-studio/workflow/new?source=${image.id}`);
  };

  const handleVariation = () => {
    if (!image) return;
    router.push(`/my-studio/workflow/new?source=${image.id}&intent=VARIATION`);
  };

  const handleDelete = async () => {
    if (!image) return;
    setIsDeleting(true);
    try {
      await deleteImage(image.id);
      router.push("/my-studio");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 6, display: "flex", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#D0103A" }} />
      </Box>
    );
  }

  if (error || !image) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 6, textAlign: "center" }}>
        <Typography sx={{ fontSize: "15px", color: "#D0103A" }}>
          {error ?? "Image not found"}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => router.push("/my-studio")}
          sx={{ mt: 2, borderRadius: 9999, textTransform: "none" }}
        >
          Back to My Studio
        </Button>
      </Box>
    );
  }

  const hasSource = image.source_image !== null;
  const pillColor = STUDIO_IMAGE_TYPE_COLOR[image.type];

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 3 }}>
      {/* Breadcrumb */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          size="small"
          onClick={() => router.push("/my-studio")}
          sx={{
            textTransform: "none",
            color: "#5F6368",
            fontSize: "13px",
            "&:hover": { bgcolor: "#F1F3F4" },
          }}
        >
          ← My Studio
        </Button>
        <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>/</Typography>
        <Typography sx={{ fontSize: "13px", color: "#1F1F1F", fontWeight: 500 }}>
          {image.name}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
        {/* Main viewer */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {compareMode && hasSource && image.source_image ? (
            <BeforeAfterSlider
              beforeUrl={staticStudioUrl(image.source_image.storage_url)}
              afterUrl={staticStudioUrl(image.storage_url)}
              beforeAlt={`${image.source_image.name} (original)`}
              afterAlt={`${image.name} (enhanced)`}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                borderRadius: "14px",
                overflow: "hidden",
                bgcolor: "#F7F7F7",
                border: "1px solid #E8EAED",
              }}
            >
              <Box
                component="img"
                src={staticStudioUrl(image.storage_url)}
                alt={image.name}
                sx={{ width: "100%", display: "block" }}
              />
            </Box>
          )}

          {hasSource && (
            <Box sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant={compareMode ? "contained" : "outlined"}
                disableElevation
                onClick={() => setCompareMode((v) => !v)}
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  fontSize: "12.5px",
                  ...(compareMode
                    ? { bgcolor: "#1F1F1F", "&:hover": { bgcolor: "#333333" } }
                    : { borderColor: "#E8EAED", color: "#1F1F1F" }),
                }}
              >
                {compareMode ? "Exit compare" : "Before / After ↔"}
              </Button>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <Box
          sx={{
            width: { xs: "100%", md: 320 },
            flexShrink: 0,
            borderRadius: "14px",
            border: "1px solid #E8EAED",
            bgcolor: "#FFFFFF",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          {/* Details */}
          <Box>
            <SidebarSectionTitle>IMAGE DETAILS</SidebarSectionTitle>
            <Meta label="Name" value={image.name} />
            <Meta
              label="Type"
              value={
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 9999,
                    bgcolor: pillColor.bg,
                    color: pillColor.fg,
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  {STUDIO_IMAGE_TYPE_LABEL[image.type]}
                </Box>
              }
            />
            <Meta
              label="Created"
              value={new Date(image.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            <Meta
              label="Size"
              value={`${(image.size_bytes / (1024 * 1024)).toFixed(2)} MB`}
            />
            {image.width_px && image.height_px && (
              <Meta label="Dimensions" value={`${image.width_px} × ${image.height_px} px`} />
            )}
          </Box>

          {/* Source image (for outputs) */}
          {image.source_image && (
            <Box>
              <SidebarSectionTitle>SOURCE IMAGE</SidebarSectionTitle>
              <Box
                onClick={() => router.push(`/my-studio/image/${image.source_image!.id}`)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  borderRadius: "8px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#F7F7F7" },
                }}
              >
                <Box
                  component="img"
                  src={staticStudioUrl(image.source_image.thumbnail_url ?? image.source_image.storage_url)}
                  alt={image.source_image.name}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "8px",
                    objectFit: "cover",
                    bgcolor: "#F5F5F5",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#1F1F1F",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {image.source_image.name}
                  </Typography>
                  <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>
                    View original
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Prompt */}
          {image.prompt_used && (
            <Box>
              <SidebarSectionTitle>PROMPT USED</SidebarSectionTitle>
              <Typography
                sx={{
                  fontSize: "12px",
                  color: "#3C4043",
                  lineHeight: 1.55,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  whiteSpace: "pre-wrap",
                  maxHeight: showFullPrompt ? "none" : 110,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {image.prompt_used}
              </Typography>
              <Button
                size="small"
                onClick={() => setShowFullPrompt((v) => !v)}
                sx={{
                  mt: 0.5,
                  textTransform: "none",
                  fontSize: "12px",
                  color: "#D0103A",
                  "&:hover": { bgcolor: "#FFF1F4" },
                }}
              >
                {showFullPrompt ? "Show less" : "Show full prompt"}
              </Button>
            </Box>
          )}

          {/* Actions */}
          <Box>
            <SidebarSectionTitle>ACTIONS</SidebarSectionTitle>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <SidebarAction onClick={handleDownload}>⬇ Download</SidebarAction>
              <SidebarAction onClick={handleEnhanceFurther}>⚡ Enhance further</SidebarAction>
              <SidebarAction onClick={handleVariation}>🪄 Generate a variation</SidebarAction>
              <SidebarAction
                onClick={() => setShowDeleteConfirm(true)}
                destructive
              >
                🗑 Delete
              </SidebarAction>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Delete confirm dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A" }}>
            Delete image?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: "0 !important" }}>
          <Typography sx={{ fontSize: "13px", color: "#5F6368", lineHeight: 1.6 }}>
            &ldquo;{image.name}&rdquo; will be removed from your library. This action can&rsquo;t be
            undone from the UI.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
            sx={{ borderColor: "#E8EAED", color: "#3C4043" }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleDelete}
            disabled={isDeleting}
            sx={{ bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Sidebar helpers ─────────────────────────────────────────────────────────

function SidebarSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "10.5px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "#9E9E9E",
        mb: 0.75,
      }}
    >
      {children}
    </Typography>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5, gap: 1 }}>
      <Typography sx={{ fontSize: "12px", color: "#5F6368", flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: "12px",
          color: "#1F1F1F",
          textAlign: "right",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function SidebarAction({
  onClick,
  destructive,
  children,
}: {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: "8px",
        border: "1px solid #E8EAED",
        bgcolor: "transparent",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 500,
        color: destructive ? "#D0103A" : "#1F1F1F",
        textAlign: "left",
        "&:hover": {
          bgcolor: destructive ? "#FFF1F4" : "#F7F7F7",
          borderColor: destructive ? "#D0103A" : "#ABABAB",
        },
      }}
    >
      {children}
    </Box>
  );
}

// ── Before/After slider ──────────────────────────────────────────────────────

function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
}) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setFromEvent = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const next = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPct(next);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) setFromEvent(e.clientX);
    };
    const onTouch = (e: TouchEvent) => {
      if (draggingRef.current && e.touches[0]) setFromEvent(e.touches[0].clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [setFromEvent]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        borderRadius: "14px",
        overflow: "hidden",
        bgcolor: "#F7F7F7",
        border: "1px solid #E8EAED",
        userSelect: "none",
        cursor: "ew-resize",
      }}
      onMouseDown={(e) => {
        draggingRef.current = true;
        setFromEvent(e.clientX);
      }}
      onTouchStart={(e) => {
        draggingRef.current = true;
        if (e.touches[0]) setFromEvent(e.touches[0].clientX);
      }}
    >
      {/* Base: enhanced image */}
      <Box
        component="img"
        src={afterUrl}
        alt={afterAlt}
        sx={{ width: "100%", display: "block" }}
      />

      {/* Overlay: clipped original */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          clipPath: `inset(0 ${100 - pct}% 0 0)`,
          transition: draggingRef.current ? "none" : "clip-path 0.12s",
        }}
      >
        <Box
          component="img"
          src={beforeUrl}
          alt={beforeAlt}
          sx={{ width: "100%", display: "block" }}
        />
      </Box>

      {/* Divider handle */}
      <Box
        role="slider"
        aria-label="Before/after comparison"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPct((p) => Math.max(0, p - 2));
          if (e.key === "ArrowRight") setPct((p) => Math.min(100, p + 2));
        }}
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${pct}%`,
          width: 2,
          bgcolor: "#FFFFFF",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
          transform: "translateX(-50%)",
          "&:focus-visible": { outline: "2px solid #D0103A", outlineOffset: 2 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: "#FFFFFF",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1F1F1F",
            fontSize: "14px",
            cursor: "ew-resize",
          }}
        >
          ↔
        </Box>
      </Box>

      {/* Labels */}
      <Box
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          px: 1,
          py: 0.25,
          borderRadius: 9999,
          bgcolor: "rgba(0,0,0,0.55)",
          color: "#FFFFFF",
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          pointerEvents: "none",
        }}
      >
        ORIGINAL
      </Box>
      <Box
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          px: 1,
          py: 0.25,
          borderRadius: 9999,
          bgcolor: "rgba(208,16,58,0.85)",
          color: "#FFFFFF",
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          pointerEvents: "none",
        }}
      >
        ENHANCED
      </Box>
    </Box>
  );
}
