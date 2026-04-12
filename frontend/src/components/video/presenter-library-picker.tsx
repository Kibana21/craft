"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import type { Presenter } from "@/types/presenter";

const STYLE_COLORS: Record<string, string> = {
  authoritative: "#1A1A18",
  conversational: "#059669",
  enthusiastic: "#D97706",
  empathetic: "#7C3AED",
};

interface PresenterCardProps {
  presenter: Presenter;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function PresenterCard({ presenter, isSelected, onSelect }: PresenterCardProps) {
  const styleColor = STYLE_COLORS[presenter.speaking_style] ?? "#717171";

  return (
    <Box
      onClick={() => onSelect(presenter.id)}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: "1.5px solid",
        borderColor: isSelected ? "#D0103A" : "#E5E5E5",
        bgcolor: isSelected ? "#FFF5F7" : "#FFFFFF",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: isSelected ? "#D0103A" : "#ABABAB",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
      }}
    >
      {/* Avatar placeholder + name row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: "#F7F7F7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            flexShrink: 0,
          }}
        >
          👤
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {presenter.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {presenter.age_range}
          </Typography>
        </Box>
        <Box sx={{ ml: "auto" }}>
          <Chip
            label={presenter.speaking_style}
            size="small"
            sx={{
              bgcolor: styleColor,
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "0.65rem",
              height: 20,
              textTransform: "capitalize",
            }}
          />
        </Box>
      </Box>

      {/* Description excerpt */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: 1.5,
        }}
      >
        {presenter.full_appearance_description}
      </Typography>
    </Box>
  );
}

interface PresenterLibraryPickerProps {
  presenters: Presenter[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function PresenterLibraryPicker({
  presenters,
  isLoading,
  selectedId,
  onSelect,
  onConfirm,
  isSubmitting,
}: PresenterLibraryPickerProps) {
  if (isLoading) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  if (presenters.length === 0) {
    return (
      <Box
        sx={{
          py: 6,
          textAlign: "center",
          border: "1.5px dashed #E5E5E5",
          borderRadius: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No presenters in your library yet.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Create a new presenter using the form on the right.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {presenters.map((p) => (
          <PresenterCard
            key={p.id}
            presenter={p}
            isSelected={selectedId === p.id}
            onSelect={onSelect}
          />
        ))}
      </Box>

      {selectedId && (
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={isSubmitting}
          sx={{
            alignSelf: "flex-start",
            bgcolor: "#D0103A",
            "&:hover": { bgcolor: "#A00D2E" },
            px: 4,
            py: 1.25,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          {isSubmitting ? "Saving…" : "Use selected presenter"}
        </Button>
      )}
    </Box>
  );
}
