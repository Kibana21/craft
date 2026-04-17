"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { FontSlotCard } from "../font-slot-card";
import type { BrandKit } from "@/types/brand-kit";

interface TypographyTabProps {
  kit: BrandKit;
  isAdmin: boolean;
  onFontUpload: (file: File, slot: "heading" | "body" | "disclaimer") => Promise<void>;
}

const SIZE_SCALE = [
  { zone: "Headline", "1080x1080": "72px", "1080x1920": "80px", whatsapp: "40px" },
  { zone: "Body", "1080x1080": "28px", "1080x1920": "32px", whatsapp: "18px" },
  { zone: "Disclaimer", "1080x1080": "18px", "1080x1920": "18px", whatsapp: "14px" },
];

export function TypographyTab({ kit, isAdmin, onFontUpload }: TypographyTabProps) {
  const fonts = kit.fonts || {};

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
          gap: 2.5,
        }}
      >
        {(["heading", "body", "disclaimer"] as const).map((slot) => (
          <FontSlotCard
            key={slot}
            slot={slot}
            fontName={fonts[slot] as string | undefined}
            fontUrl={fonts[`${slot}_url`] as string | undefined}
            isAdmin={isAdmin}
            onUpload={(file) => onFontUpload(file, slot)}
          />
        ))}
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5, color: "#1F1F1F" }}>
          Size scale reference
        </Typography>
        <Box
          sx={{
            border: "1px solid #E8EAED",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F7F7F7" }}>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Zone</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>1080 x 1080</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>1080 x 1920</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>WhatsApp card</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {SIZE_SCALE.map((row) => (
                <TableRow key={row.zone}>
                  <TableCell sx={{ fontSize: 13 }}>{row.zone}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{row["1080x1080"]}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{row["1080x1920"]}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{row.whatsapp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography sx={{ mt: 1, fontSize: 11, color: "#9E9E9E" }}>
          Values are baked into the compositing/export pipeline — not editable here.
        </Typography>
      </Box>
    </Box>
  );
}
