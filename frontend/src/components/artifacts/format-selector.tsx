"use client";

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
    <div>
      <label className="mb-2 block text-sm font-medium text-[#484848]">
        Output format
      </label>
      <div className="flex gap-3">
        {available.map((format) => (
          <button
            key={format.key}
            type="button"
            onClick={() => onChange(format.key)}
            className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-200 ${
              value === format.key
                ? "border-2 border-[#222222] bg-[#F7F7F7]"
                : "border-2 border-[#EBEBEB] bg-white hover:border-[#DDDDDD]"
            }`}
          >
            <div
              className={`rounded border-2 ${
                value === format.key
                  ? "border-[#222222] bg-[#EBEBEB]"
                  : "border-[#DDDDDD] bg-[#F7F7F7]"
              }`}
              style={{ width: format.width, height: format.height }}
            />
            <span className="text-xs font-medium text-[#484848]">
              {format.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
