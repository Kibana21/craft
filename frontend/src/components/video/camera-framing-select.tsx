"use client";

import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import type { CameraFraming } from "@/types/scene";

const OPTIONS: { value: CameraFraming; label: string; hint: string }[] = [
  { value: "wide_shot",          label: "Wide Shot",          hint: "Full environment visible; presenter small in frame" },
  { value: "medium_shot",        label: "Medium Shot",        hint: "Waist-up; most common for talking-head videos" },
  { value: "close_up",           label: "Close-Up",           hint: "Face fills the frame; high emotional impact" },
  { value: "over_the_shoulder",  label: "Over the Shoulder",  hint: "Behind subject looking at something else" },
  { value: "two_shot",           label: "Two Shot",           hint: "Two subjects in frame side by side" },
  { value: "aerial",             label: "Aerial",             hint: "Bird's-eye view from above" },
  { value: "pov",                label: "POV",                hint: "First-person perspective of the presenter" },
];

interface CameraFramingSelectProps {
  value: CameraFraming;
  onChange: (value: CameraFraming) => void;
  size?: "small" | "medium";
  fullWidth?: boolean;
}

export function CameraFramingSelect({ value, onChange, size = "small", fullWidth = true }: CameraFramingSelectProps) {
  const handleChange = (e: SelectChangeEvent) => {
    onChange(e.target.value as CameraFraming);
  };

  return (
    <FormControl fullWidth={fullWidth} size={size}>
      <InputLabel>Camera framing</InputLabel>
      <Select value={value} label="Camera framing" onChange={handleChange}>
        {OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            <span style={{ fontWeight: 600 }}>{opt.label}</span>
            <span style={{ color: "#717171", fontSize: "0.78rem", marginLeft: 8 }}>
              — {opt.hint}
            </span>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
