"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";

const AIA_PRODUCTS = [
  "PAA — Personal Accident Advantage",
  "HealthShield",
  "AIA Vitality",
  "PRUWealth",
  "AIA Family Protect",
  "SG60 Special",
  "General / Other",
];

interface BriefData {
  name: string;
  product: string;
  target_audience: string;
  campaign_period: string;
  key_message: string;
}

interface StepBriefProps {
  value: BriefData;
  onChange: (data: BriefData) => void;
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    fontSize: 16,
    color: "#1F1F1F",
    "& fieldset": { borderColor: "#E8EAED" },
    "&:hover fieldset": { borderColor: "#DADCE0" },
    "&.Mui-focused fieldset": { borderColor: "#D0103A" },
  },
  "& input::placeholder, & textarea::placeholder": { color: "#9E9E9E", opacity: 1 },
};

export function StepBrief({ value, onChange }: StepBriefProps) {
  const update = (field: keyof BriefData, val: string) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{ fontSize: 28, fontWeight: 700, color: "#1F1F1F" }}
      >
        Tell us about the campaign
      </Typography>
      <Typography sx={{ mt: 1, fontSize: 16, color: "#5F6368" }}>
        This brief is shared by every artifact in the project
      </Typography>

      <Box sx={{ mt: 5, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Row 1: name + product */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
          <TextField
            label="Project / campaign name"
            variant="outlined"
            size="small"
            fullWidth
            value={value.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g., PAA Launch Q2 2025"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={inputSx}
          />

          <FormControl size="small" fullWidth>
            <InputLabel
              shrink
              sx={{
                color: "#5F6368",
                "&.Mui-focused": { color: "#D0103A" },
              }}
            >
              Product
            </InputLabel>
            <Select
              value={value.product}
              onChange={(e) => update("product", e.target.value)}
              label="Product"
              displayEmpty
              renderValue={(selected) =>
                selected ? (
                  <Typography sx={{ fontSize: 16, color: "#1F1F1F" }}>
                    {selected}
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: 16, color: "#9E9E9E" }}>
                    Select a product
                  </Typography>
                )
              }
              sx={{
                borderRadius: "10px",
                fontSize: 16,
                color: "#1F1F1F",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E8EAED" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#DADCE0" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#D0103A" },
              }}
            >
              {AIA_PRODUCTS.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Row 2: audience + campaign period */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
          <TextField
            label="Primary audience"
            variant="outlined"
            size="small"
            fullWidth
            value={value.target_audience}
            onChange={(e) => update("target_audience", e.target.value)}
            placeholder="e.g., Young parents (28–35)"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={inputSx}
          />

          <TextField
            label="Launch / campaign period"
            variant="outlined"
            size="small"
            fullWidth
            value={value.campaign_period}
            onChange={(e) => update("campaign_period", e.target.value)}
            placeholder="e.g., 1 May – 30 Jun 2025"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={inputSx}
          />
        </Box>

        {/* Key message */}
        <TextField
          label="Key message"
          variant="outlined"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={value.key_message}
          onChange={(e) => update("key_message", e.target.value)}
          placeholder="e.g., Affordable protection for young parents — from $1.20/day, with hospitalisation income benefit included."
          slotProps={{ inputLabel: { shrink: true } }}
          sx={inputSx}
        />
      </Box>
    </Box>
  );
}
