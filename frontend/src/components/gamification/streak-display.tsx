"use client";

interface StreakDisplayProps {
  streak: number;
  size?: "sm" | "md" | "lg";
}

export function StreakDisplay({ streak, size = "md" }: StreakDisplayProps) {
  const textSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-base";
  const labelSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? "text-base" : size === "lg" ? "text-3xl" : "text-xl";

  return (
    <div className="flex items-center gap-1.5">
      <span className={iconSize}>{streak > 0 ? "🔥" : "💤"}</span>
      <span className={`font-bold text-[#222222] ${textSize}`}>{streak}</span>
      <span className={`text-[#717171] ${labelSize}`}>day streak</span>
    </div>
  );
}
