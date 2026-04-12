"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";

const FORMATS = [
  { key: "1:1", label: "1:1 Instagram", width: 40, height: 40 },
  { key: "4:5", label: "4:5 Portrait", width: 36, height: 45 },
  { key: "9:16", label: "9:16 Story", width: 28, height: 50 },
  { key: "800x800", label: "800x800 WhatsApp", width: 40, height: 40 },
];

interface FormatSelectorProps {
  value: string;
  onChange: (format: string) => void;
  options?: string[];
}

export function FormatSelector({ value, onChange, options }: FormatSelectorProps) {
  const available = options
    ? FORMATS.filter((f) => options.includes(f.key))
    : FORMATS;

  return (
    <Box>
      <Typography
        component="label"
        sx={{
          display: "block",
          mb: 1,
          fontSize: "14px",
          fontWeight: 500,
          color: "#484848",
        }}
      >
        Output format
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        {available.map((format) => (
          <ButtonBase
            key={format.key}
            onClick={() => onChange(format.key)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              borderRadius: "12px",
              p: 2,
              border: "2px solid",
              transition: "all 0.2s",
              ...(value === format.key
                ? {
                    borderColor: "#222222",
                    bgcolor: "#F7F7F7",
                  }
                : {
                    borderColor: "#EBEBEB",
                    bgcolor: "#FFFFFF",
                    "&:hover": { borderColor: "#DDDDDD" },
                  }),
            }}
          >
            <Box
              sx={{
                width: format.width,
                height: format.height,
                borderRadius: "4px",
                border: "2px solid",
                ...(value === format.key
                  ? { borderColor: "#222222", bgcolor: "#EBEBEB" }
                  : { borderColor: "#DDDDDD", bgcolor: "#F7F7F7" }),
              }}
            />
            <Typography sx={{ fontSize: "12px", fontWeight: 500, color: "#484848" }}>
              {format.label}
            </Typography>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
