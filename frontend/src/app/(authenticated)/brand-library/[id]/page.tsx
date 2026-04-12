"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useAuth } from "@/components/providers/auth-provider";
import {
  fetchLibraryItemDetail,
  reviewLibraryItem,
  remixLibraryItem,
  type BrandLibraryDetailItem,
} from "@/lib/api/brand-library";

const TYPE_ICONS: Record<string, string> = {
  poster: "◻", whatsapp_card: "✉", reel: "▶", video: "▶",
  story: "◻", deck: "📋", infographic: "📊", slide_deck: "📋",
};

const TYPE_BG: Record<string, string> = {
  poster:        "linear-gradient(135deg, #7c3aed, #a855f7)",
  whatsapp_card: "linear-gradient(135deg, #dc2626, #ef4444)",
  reel:          "linear-gradient(135deg, #059669, #14b8a6)",
  video:         "linear-gradient(135deg, #059669, #14b8a6)",
  story:         "linear-gradient(135deg, #d97706, #f97316)",
  deck:          "linear-gradient(135deg, #334155, #475569)",
  infographic:   "linear-gradient(135deg, #0891b2, #06b6d4)",
  slide_deck:    "linear-gradient(135deg, #334155, #475569)",
};

const STATUS_SX: Record<string, object> = {
  published:      { bgcolor: "#F0FFF0", color: "#008A05" },
  pending_review: { bgcolor: "#FFFBEB", color: "#B45309" },
  rejected:       { bgcolor: "#FFF0F3", color: "#D0103A" },
};

export default function LibraryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<BrandLibraryDetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    if (!id) return;
    fetchLibraryItemDetail(id)
      .then(setItem)
      .catch(() => router.push("/brand-library"))
      .finally(() => setIsLoading(false));
  }, [id, router]);

  const handleApprove = async () => {
    if (!item) return;
    setIsActing(true);
    try {
      const updated = await reviewLibraryItem(item.id, "approve");
      setItem(updated);
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!item) return;
    setIsActing(true);
    try {
      const updated = await reviewLibraryItem(item.id, "reject", rejectReason);
      setItem(updated);
      setShowReject(false);
    } finally {
      setIsActing(false);
    }
  };

  const handleRemix = async () => {
    if (!item) return;
    setIsActing(true);
    try {
      const result = await remixLibraryItem(item.id);
      router.push(`/projects/${result.project_id}`);
    } catch {
      setIsActing(false);
    }
  };

  if (isLoading || !item) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 720, px: 3, py: 6 }}>
        <Box
          sx={{
            height: 32,
            width: 192,
            borderRadius: "8px",
            bgcolor: "#F7F7F7",
            "@keyframes pulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } },
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            mt: 3,
            height: 384,
            borderRadius: "12px",
            bgcolor: "#F7F7F7",
            "@keyframes pulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } },
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </Box>
    );
  }

  const icon = TYPE_ICONS[item.artifact.type] || "◻";
  const bg = TYPE_BG[item.artifact.type] || "linear-gradient(135deg, #7c3aed, #a855f7)";

  return (
    <Box sx={{ mx: "auto", maxWidth: 720, px: 3, py: 6 }}>
      {/* Back */}
      <Button
        variant="outlined"
        size="small"
        disableElevation
        onClick={() => router.push("/brand-library")}
        startIcon={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4L6 8l4 4" />
          </svg>
        }
        sx={{
          mb: 3,
          borderRadius: 9999,
          textTransform: "none",
          fontSize: "13px",
          fontWeight: 500,
          color: "#5F6368",
          borderColor: "#E8EAED",
          "&:hover": { bgcolor: "#F1F3F4", borderColor: "#DADCE0", color: "#1F1F1F" },
        }}
      >
        Back to Brand Library
      </Button>

      {/* Main card */}
      <Box
        sx={{
          overflow: "hidden",
          borderRadius: "16px",
          border: "1px solid #EBEBEB",
          bgcolor: "#FFFFFF",
        }}
      >
        {/* Preview header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 192,
            background: bg,
          }}
        >
          <Typography sx={{ fontSize: "60px", color: "rgba(255,255,255,0.4)" }}>
            {icon}
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box>
              <Typography sx={{ fontSize: "28px", fontWeight: 700, color: "#1F1F1F" }}>
                {item.artifact.name}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: "16px", color: "#5F6368" }}>
                Published by {item.published_by.name} · {item.remix_count} remixes
              </Typography>
              <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Box
                  component="span"
                  sx={{
                    borderRadius: 9999,
                    px: 1.5,
                    py: 0.5,
                    fontSize: "12px",
                    fontWeight: 600,
                    ...(STATUS_SX[item.status] ?? { bgcolor: "#F7F7F7", color: "#484848" }),
                  }}
                >
                  {item.status.replace("_", " ")}
                </Box>
                <Box
                  component="span"
                  sx={{
                    borderRadius: 9999,
                    px: 1.5,
                    py: 0.5,
                    fontSize: "12px",
                    fontWeight: 600,
                    bgcolor: "#F0FFF0",
                    color: "#008A05",
                  }}
                >
                  Official · Compliant
                </Box>
                {item.artifact.product && (
                  <Box
                    component="span"
                    sx={{
                      borderRadius: 9999,
                      px: 1.5,
                      py: 0.5,
                      fontSize: "12px",
                      fontWeight: 600,
                      bgcolor: "#F7F7F7",
                      color: "#484848",
                    }}
                  >
                    {item.artifact.product}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Artifact content preview */}
          {item.artifact.content && (
            <Box
              sx={{
                mt: 3,
                borderRadius: "12px",
                bgcolor: "#F7F7F7",
                p: 2.5,
              }}
            >
              <Typography sx={{ mb: 1.5, fontSize: "14px", fontWeight: 600, color: "#484848" }}>
                Content details
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 1.5,
                  fontSize: "14px",
                }}
              >
                {Object.entries(item.artifact.content)
                  .filter(([key]) => !["locks", "remixed_from"].includes(key))
                  .map(([key, value]) => (
                    <Box key={key}>
                      <Typography sx={{ fontSize: "12px", fontWeight: 500, color: "#B0B0B0" }}>
                        {key.replace(/_/g, " ")}
                      </Typography>
                      <Typography sx={{ mt: 0.25, fontSize: "14px", color: "#484848" }}>
                        {String(value)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </Box>
          )}

          {/* Rejection reason */}
          {item.rejection_reason && (
            <Box
              sx={{
                mt: 2,
                borderRadius: "12px",
                border: "1px solid",
                borderColor: "#FECACA",
                bgcolor: "#FFF0F3",
                p: 2,
              }}
            >
              <Typography sx={{ fontSize: "14px", fontWeight: 500, color: "#D0103A" }}>
                Rejected: {item.rejection_reason}
              </Typography>
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ mt: 4, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {isAdmin && item.status === "pending_review" && (
              <>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleApprove}
                  disabled={isActing}
                  sx={{
                    borderRadius: 9999,
                    textTransform: "none",
                    bgcolor: "#008A05",
                    color: "#FFFFFF",
                    fontSize: "16px",
                    fontWeight: 600,
                    px: 3,
                    py: 1.5,
                    "&:hover": { bgcolor: "#047857" },
                    "&:disabled": { opacity: 0.5, bgcolor: "#008A05", color: "#FFFFFF" },
                  }}
                >
                  {isActing ? "Approving..." : "Approve & Publish"}
                </Button>
                <Button
                  variant="outlined"
                  disableElevation
                  onClick={() => setShowReject(!showReject)}
                  sx={{
                    borderRadius: 9999,
                    textTransform: "none",
                    fontSize: "16px",
                    fontWeight: 600,
                    px: 3,
                    py: 1.5,
                    color: "#D0103A",
                    borderColor: "#D0103A",
                    "&:hover": { bgcolor: "#FFF0F3", borderColor: "#D0103A" },
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {isAdmin && item.status === "published" && (
              <Button
                variant="outlined"
                disableElevation
                onClick={() => reviewLibraryItem(item.id, "unpublish").then(setItem)}
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  fontSize: "16px",
                  fontWeight: 600,
                  px: 3,
                  py: 1.5,
                  color: "#1F1F1F",
                  borderColor: "#222222",
                  "&:hover": { bgcolor: "#F7F7F7", borderColor: "#222222" },
                }}
              >
                Unpublish
              </Button>
            )}
            {!isAdmin && item.status === "published" && (
              <Button
                variant="contained"
                disableElevation
                onClick={handleRemix}
                disabled={isActing}
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  bgcolor: "#D0103A",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  "&:hover": { bgcolor: "#B80E33" },
                  "&:disabled": { opacity: 0.5, bgcolor: "#D0103A", color: "#FFFFFF" },
                }}
              >
                {isActing ? "Creating remix..." : "Remix into my project →"}
              </Button>
            )}
          </Box>

          {/* Reject form */}
          {showReject && (
            <Box
              sx={{
                mt: 2,
                borderRadius: "12px",
                border: "1px solid #EBEBEB",
                bgcolor: "#F7F7F7",
                p: 2,
              }}
            >
              <TextField
                fullWidth
                multiline
                rows={3}
                size="small"
                variant="outlined"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                sx={{
                  mb: 1.5,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: "16px",
                    color: "#222222",
                    bgcolor: "#FFFFFF",
                    "& fieldset": { borderColor: "#DDDDDD" },
                    "&:hover fieldset": { borderColor: "#BBBBBB" },
                    "&.Mui-focused fieldset": {
                      borderColor: "#D0103A",
                      boxShadow: "0 0 0 3px rgba(208,16,58,0.08)",
                    },
                  },
                }}
              />
              <Button
                variant="contained"
                disableElevation
                onClick={handleReject}
                disabled={isActing || !rejectReason.trim()}
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  bgcolor: "#D0103A",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 600,
                  px: 3,
                  py: 1.5,
                  "&:hover": { bgcolor: "#B80E33" },
                  "&:disabled": { opacity: 0.5, bgcolor: "#D0103A", color: "#FFFFFF" },
                }}
              >
                Confirm rejection
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
