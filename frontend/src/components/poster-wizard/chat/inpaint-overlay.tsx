"use client";

// Canvas-based region selection overlay for inpainting (doc 07 §Inpainting from Chat).
// User drags a bounding box over the poster image; on submit, a black-mask PNG is
// constructed from the box and sent to the parent alongside the description.

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface InpaintOverlayProps {
  imageUrl: string;
  onSubmit: (description: string, maskFile: File, coveragePct: number) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function InpaintOverlay({ imageUrl, onSubmit, onCancel, isLoading }: InpaintOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [rect, setRect] = useState<Rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState("");
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);

  // Refs to avoid stale closures inside mouse handlers
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const liveRect = useRef<Rect | null>(null);

  // Sync canvas dimensions once the image loads
  const syncCanvasSize = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth || img.clientWidth;
    canvas.height = img.naturalHeight || img.clientHeight;
  }, []);

  // Draw the selection onto the canvas
  const drawSelection = useCallback((r: Rect | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (r && (r.w > 0 || r.h > 0)) {
      // Dim entire canvas
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Punch out the selected area
      ctx.clearRect(r.x, r.y, r.w, r.h);
      // Selection border
      ctx.strokeStyle = "#D0103A";
      ctx.lineWidth = Math.max(1, canvas.width / 300);
      ctx.setLineDash([]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      // Corner handles
      const handle = Math.max(4, canvas.width / 120);
      ctx.fillStyle = "#D0103A";
      [[r.x, r.y], [r.x + r.w - handle, r.y], [r.x, r.y + r.h - handle], [r.x + r.w - handle, r.y + r.h - handle]].forEach(
        ([hx, hy]) => ctx.fillRect(hx, hy, handle, handle),
      );
    } else {
      // Instruction dim
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Re-draw whenever rect changes
  useEffect(() => {
    drawSelection(rect);
  }, [rect, drawSelection]);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    return {
      x: (e.clientX - bounds.left) * scaleX,
      y: (e.clientY - bounds.top) * scaleY,
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLoading) return;
    const pt = getCanvasPoint(e);
    startPt.current = pt;
    liveRect.current = null;
    setIsDragging(true);
    setRect(null);
    setDescription("");
    setShowCoverageWarning(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !startPt.current) return;
    const pt = getCanvasPoint(e);
    const r: Rect = {
      x: Math.min(pt.x, startPt.current.x),
      y: Math.min(pt.y, startPt.current.y),
      w: Math.abs(pt.x - startPt.current.x),
      h: Math.abs(pt.y - startPt.current.y),
    };
    liveRect.current = r;
    drawSelection(r); // draw live without state update for perf
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !startPt.current) return;
    setIsDragging(false);
    const pt = getCanvasPoint(e);
    const r: Rect = {
      x: Math.min(pt.x, startPt.current.x),
      y: Math.min(pt.y, startPt.current.y),
      w: Math.abs(pt.x - startPt.current.x),
      h: Math.abs(pt.y - startPt.current.y),
    };
    startPt.current = null;

    if (r.w < 10 || r.h < 10) {
      // Too small — cancel selection
      setRect(null);
      drawSelection(null);
      return;
    }

    setRect(r);
    const canvas = canvasRef.current;
    if (canvas) {
      const coverage = (r.w * r.h) / (canvas.width * canvas.height);
      setShowCoverageWarning(coverage > 0.6);
    }
  };

  const handleSubmit = () => {
    if (!rect || !description.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Build mask: black inside selection, transparent outside (keep)
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const coverage = (rect.w * rect.h) / (canvas.width * canvas.height);

    maskCanvas.toBlob((blob) => {
      if (!blob) return;
      const maskFile = new File([blob], "mask.png", { type: "image/png" });
      onSubmit(description.trim(), maskFile, coverage);
    }, "image/png");
  };

  return (
    <Box sx={{ position: "relative", borderRadius: "12px", overflow: "hidden", bgcolor: "#000" }}>
      {/* Base image */}
      <Box
        component="img"
        ref={imgRef}
        src={imageUrl}
        alt="Select a region to refine"
        onLoad={syncCanvasSize}
        sx={{ width: "100%", display: "block", userSelect: "none" }}
        draggable={false}
      />

      {/* Interaction canvas — covers the image exactly */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDragging) {
            setIsDragging(false);
            if (liveRect.current) setRect(liveRect.current);
          }
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          cursor: isLoading ? "not-allowed" : "crosshair",
          touchAction: "none",
        }}
      />

      {/* Instruction hint (no selection yet) */}
      {!rect && !isDragging && (
        <Box
          sx={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "rgba(0,0,0,0.72)",
            color: "white",
            px: 2,
            py: 0.75,
            borderRadius: "8px",
            fontSize: "12px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Drag to select the region you want to change
        </Box>
      )}

      {/* Description + controls panel (after selection is drawn) */}
      {rect && !isDragging && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: "rgba(255,255,255,0.97)",
            p: 1.5,
            boxShadow: "0 -2px 12px rgba(0,0,0,0.12)",
          }}
        >
          {showCoverageWarning && (
            <Typography sx={{ mb: 1, fontSize: "11px", color: "#B45309" }}>
              ⚠ Large region selected. Consider regenerating the whole poster instead. You can still proceed.
            </Typography>
          )}
          <TextField
            fullWidth
            size="small"
            placeholder="Describe what should change in this area…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            sx={{
              mb: 1,
              "& .MuiOutlinedInput-root": {
                fontSize: "13px",
                borderRadius: "8px",
                "& fieldset": { borderColor: "#E5E5E5" },
                "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
              },
            }}
          />
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button
              size="small"
              onClick={onCancel}
              disabled={isLoading}
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#5F6368",
                fontSize: "12px",
              }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              disabled={!description.trim() || isLoading}
              onClick={handleSubmit}
              startIcon={isLoading ? <CircularProgress size={12} sx={{ color: "white" }} /> : undefined}
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                bgcolor: "#D0103A",
                color: "white",
                fontSize: "12px",
                "&:hover": { bgcolor: "#A00D2E" },
                "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
              }}
            >
              {isLoading ? "Applying…" : "Apply"}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
