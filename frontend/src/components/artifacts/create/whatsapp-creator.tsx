"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { ToneSelector } from "../tone-selector";
import { TaglineGenerator } from "../tagline-generator";

interface WhatsAppCreatorProps {
  product: string;
  audience: string;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function WhatsAppCreator({ product, audience, onSave, isSaving }: WhatsAppCreatorProps) {
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("friendly");

  const handleSave = () => {
    onSave({
      headline,
      message,
      product,
      tone,
      format: "800x800",
      type: "whatsapp_card",
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <TaglineGenerator
        product={product}
        audience={audience}
        tone={tone}
        value={headline}
        onChange={setHeadline}
      />

      <Box>
        <Typography
          component="label"
          sx={{ display: "block", mb: 1, fontSize: "14px", fontWeight: 500, color: "#484848" }}
        >
          Message
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          size="small"
          variant="outlined"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your WhatsApp message..."
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              fontSize: "16px",
              color: "#222222",
              "& fieldset": { borderColor: "#DDDDDD" },
              "&:hover fieldset": { borderColor: "#BBBBBB" },
              "&.Mui-focused fieldset": {
                borderColor: "#D0103A",
                boxShadow: "0 0 0 3px rgba(208,16,58,0.08)",
              },
            },
            "& textarea::placeholder": { color: "#B0B0B0", opacity: 1 },
          }}
        />
      </Box>

      <ToneSelector value={tone} onChange={setTone} />

      {/* WhatsApp card preview */}
      <Box
        sx={{
          mx: "auto",
          width: 256,
          overflow: "hidden",
          borderRadius: "12px",
          border: "1px solid #EBEBEB",
          bgcolor: "#FFFFFF",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 192,
            background: "linear-gradient(135deg, #dc2626, #f43f5e)",
            p: 3,
            textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>
            {headline || "Your headline"}
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontSize: "14px", color: "#484848" }}>
            {message || "Your message here..."}
          </Typography>
          <Typography sx={{ mt: 1, fontSize: "12px", color: "#B0B0B0" }}>
            {product} · AIA Singapore
          </Typography>
        </Box>
      </Box>

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleSave}
        disabled={isSaving || !headline.trim()}
        sx={{
          borderRadius: 9999,
          textTransform: "none",
          bgcolor: "#D0103A",
          color: "#FFFFFF",
          fontSize: "16px",
          fontWeight: 600,
          py: 1.5,
          "&:hover": { bgcolor: "#B80E33" },
          "&:disabled": { opacity: 0.4, bgcolor: "#D0103A", color: "#FFFFFF", cursor: "not-allowed" },
        }}
      >
        {isSaving ? "Creating card..." : "Create WhatsApp card"}
      </Button>
    </Box>
  );
}
