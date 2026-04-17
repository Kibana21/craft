"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { TintRow } from "./tint-row";

interface ColourCardProps {
  role: "primary" | "secondary" | "accent";
  hex: string;
  name: string;
  usage: string;
  isEditMode: boolean;
  showTints?: boolean;
  onHexChange: (hex: string) => void;
  onNameChange: (name: string) => void;
  onUsageChange: (usage: string) => void;
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColourCard({
  role,
  hex,
  name,
  usage,
  isEditMode,
  showTints,
  onHexChange,
  onNameChange,
  onUsageChange,
}: ColourCardProps) {
  const isValidHex = HEX_REGEX.test(hex);

  return (
    <Box
      sx={{
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        p: 2.5,
        backgroundColor: "#FFFFFF",
      }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: "10px",
            backgroundColor: isValidHex ? hex : "#CCC",
            flexShrink: 0,
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isEditMode ? (
            <TextField
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              variant="standard"
              placeholder="Color name"
              slotProps={{ input: { disableUnderline: true } }}
              sx={{ "& input": { fontSize: 15, fontWeight: 600, p: 0 } }}
              fullWidth
            />
          ) : (
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{name || role}</Typography>
          )}

          {isEditMode ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Box
                component="input"
                type="color"
                value={isValidHex ? hex : "#000000"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onHexChange(e.target.value)}
                sx={{
                  width: 24,
                  height: 24,
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  p: 0,
                }}
              />
              <Box
                component="input"
                type="text"
                value={hex}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onHexChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)
                }
                sx={{
                  width: 90,
                  fontSize: 13,
                  fontFamily: "monospace",
                  border: `1px solid ${isValidHex ? "#E8EAED" : "#D0103A"}`,
                  borderRadius: "6px",
                  px: 1,
                  py: 0.25,
                  textTransform: "uppercase",
                  outline: "none",
                  "&:focus": { borderColor: "#D0103A" },
                }}
              />
            </Box>
          ) : (
            <Typography sx={{ fontSize: 13, fontFamily: "monospace", color: "#5F6368", mt: 0.25 }}>
              {hex}
            </Typography>
          )}
        </Box>
      </Box>

      {isEditMode ? (
        <TextField
          value={usage}
          onChange={(e) => onUsageChange(e.target.value)}
          variant="standard"
          placeholder="Usage description"
          slotProps={{ input: { disableUnderline: true } }}
          sx={{ mt: 1.5, "& input": { fontSize: 12, color: "#5F6368", p: 0 } }}
          fullWidth
        />
      ) : (
        usage && (
          <Typography sx={{ mt: 1.5, fontSize: 12, color: "#5F6368" }}>{usage}</Typography>
        )
      )}

      {showTints && <TintRow hex={hex} />}
    </Box>
  );
}
