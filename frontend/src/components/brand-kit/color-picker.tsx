"use client";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ label, value, onChange, disabled }: ColorPickerProps) {
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#484848]">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={isValidHex ? value : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            disabled={disabled}
            className="h-10 w-10 cursor-pointer rounded-lg border border-[#DDDDDD] p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            title={label}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            if (v.length <= 7) onChange(v);
          }}
          disabled={disabled}
          placeholder="#D0103A"
          className={`w-28 rounded-lg border px-3 py-2 text-sm font-mono transition-colors focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${
            isValidHex
              ? "border-[#DDDDDD] text-[#222222] focus:border-[#222222]"
              : "border-[#FF5A5F] text-[#FF5A5F]"
          }`}
        />
        {isValidHex && (
          <div
            className="h-8 w-8 flex-shrink-0 rounded-full border border-[#DDDDDD] shadow-sm"
            style={{ backgroundColor: value }}
          />
        )}
      </div>
    </div>
  );
}
