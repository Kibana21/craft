import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import type { BrandLibraryItem } from "@/types/brand-library";

const TYPE_CONFIG: Record<string, { emoji: string; bg: string }> = {
  poster:        { emoji: "🖼️", bg: "#F3E8FD" },
  whatsapp_card: { emoji: "💬", bg: "#E6F4EA" },
  reel:          { emoji: "🎬", bg: "#E8F0FE" },
  video:         { emoji: "▶️", bg: "#E8F0FE" },
  story:         { emoji: "📱", bg: "#FEF7E0" },
  deck:          { emoji: "📋", bg: "#F1F3F4" },
  infographic:   { emoji: "📊", bg: "#FCE8E6" },
  slide_deck:    { emoji: "🗂️", bg: "#F1F3F4" },
};

const STATUS_BADGE_SX: Record<string, object> = {
  published:      { bgcolor: "#E6F4EA", color: "#188038" },
  approved:       { bgcolor: "#E6F4EA", color: "#188038" },
  pending_review: { bgcolor: "#FEF7E0", color: "#B45309" },
  rejected:       { bgcolor: "#FCE8E6", color: "#C5221F" },
};

const STATUS_LABEL: Record<string, string> = {
  published:      "Published",
  approved:       "Approved",
  pending_review: "Pending review",
  rejected:       "Rejected",
};

interface LibraryItemCardProps {
  item: BrandLibraryItem;
  isAdmin?: boolean;
  onRemix?: () => void;
  onManage?: () => void;
}

export function LibraryItemCard({ item, isAdmin = false, onRemix, onManage }: LibraryItemCardProps) {
  const config = TYPE_CONFIG[item.artifact.type] ?? { emoji: "📄", bg: "#F1F3F4" };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        borderRadius: "12px",
        border: "1px solid #E8EAED",
        bgcolor: "#FFFFFF",
        px: 2,
        py: 1.75,
        transition: "all 0.15s",
        "&:hover": {
          borderColor: "#DADCE0",
          boxShadow: "0 1px 4px rgba(32,33,36,0.08)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "12px",
          fontSize: "18px",
          bgcolor: config.bg,
        }}
      >
        {config.emoji}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#1F1F1F",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.artifact.name}
        </Typography>
        <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "12px", color: "#80868B" }}>
            {item.artifact.product || item.artifact.type} · {item.remix_count} remixes
          </Typography>
          {isAdmin ? (
            <Box
              component="span"
              sx={{
                borderRadius: 9999,
                px: 1,
                py: 0.25,
                fontSize: "11px",
                fontWeight: 500,
                ...(STATUS_BADGE_SX[item.status] ?? { bgcolor: "#F1F3F4", color: "#5F6368" }),
              }}
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </Box>
          ) : (
            <Box
              component="span"
              sx={{
                borderRadius: 9999,
                px: 1,
                py: 0.25,
                fontSize: "11px",
                fontWeight: 500,
                bgcolor: "#E6F4EA",
                color: "#188038",
              }}
            >
              Compliant
            </Box>
          )}
        </Box>
      </Box>

      {isAdmin ? (
        <Button
          variant="outlined"
          size="small"
          disableElevation
          onClick={onManage}
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 500,
            color: "#3C4043",
            borderColor: "#DADCE0",
            "&:hover": { bgcolor: "#F1F3F4", borderColor: "#DADCE0" },
          }}
        >
          Manage
        </Button>
      ) : (
        <Button
          variant="contained"
          size="small"
          disableElevation
          onClick={onRemix}
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 500,
            bgcolor: "#D0103A",
            color: "#FFFFFF",
            "&:hover": { bgcolor: "#B80E33" },
          }}
        >
          Remix
        </Button>
      )}
    </Box>
  );
}
