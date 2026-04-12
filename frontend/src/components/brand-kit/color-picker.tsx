"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ label, value, onChange, disabled }: ColorPickerProps) {
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography
        component="label"
        sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#484848" }}
      >
        {label}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {/* Native color swatch input */}
        <Box sx={{ position: "relative" }}>
          <Box
            component="input"
            type="color"
            value={isValidHex ? value : "#000000"}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value.toUpperCase())
            }
            disabled={disabled}
            title={label}
            sx={{
              width: 40,
              height: 40,
              cursor: disabled ? "not-allowed" : "pointer",
              borderRadius: "8px",
              border: "1px solid #DDDDDD",
              p: 0.25,
              opacity: disabled ? 0.5 : 1,
              "&:disabled": { cursor: "not-allowed" },
            }}
          />
        </Box>

        {/* Hex text input */}
        <Box
          component="input"
          type="text"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = e.target.value.toUpperCase();
            if (v.length <= 7) onChange(v);
          }}
          disabled={disabled}
          placeholder="#D0103A"
          sx={{
            width: 112,
            borderRadius: "8px",
            border: `1px solid ${isValidHex ? "#DDDDDD" : "#FF5A5F"}`,
            px: 1.5,
            py: 1,
            fontSize: "0.875rem",
            fontFamily: "monospace",
            color: isValidHex ? "#222222" : "#FF5A5F",
            outline: "none",
            transition: "border-color 0.15s",
            bgcolor: "#FFFFFF",
            "&:focus": {
              borderColor: isValidHex ? "#222222" : "#FF5A5F",
            },
            "&:disabled": {
              cursor: "not-allowed",
              opacity: 0.5,
            },
          }}
        />

        {/* Live color preview swatch */}
        {isValidHex && (
          <Box
            sx={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              border: "1px solid #DDDDDD",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              bgcolor: value,
            }}
          />
        )}
      </Box>
    </Box>
  );
}
