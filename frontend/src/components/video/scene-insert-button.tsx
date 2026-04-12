"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";

interface SceneInsertButtonProps {
  onClick: () => void;
}

export function SceneInsertButton({ onClick }: SceneInsertButtonProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 0.5,
        opacity: 0,
        transition: "opacity 0.15s",
        "&:hover": { opacity: 1 },
        // Parent .scene-list-item should set opacity on hover via group
      }}
    >
      <Box sx={{ flex: 1, height: "1px", bgcolor: "#E5E5E5" }} />
      <ButtonBase
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.5,
          py: 0.4,
          borderRadius: 999,
          border: "1px dashed #ABABAB",
          color: "#717171",
          fontSize: "0.75rem",
          fontWeight: 600,
          bgcolor: "#FFFFFF",
          "&:hover": { borderColor: "#D0103A", color: "#D0103A" },
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.9rem" }}>+</Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>Insert scene</Typography>
      </ButtonBase>
      <Box sx={{ flex: 1, height: "1px", bgcolor: "#E5E5E5" }} />
    </Box>
  );
}
