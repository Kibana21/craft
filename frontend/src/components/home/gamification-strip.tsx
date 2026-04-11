"use client";

export function GamificationStrip() {
  const streak = 5;
  const points = 2847;
  const percentile = 12;
  const progress = 68;

  return (
    <div className="border-t border-[#EBEBEB] bg-white px-6 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        <span className="text-xl">🔥</span>
        <span className="text-sm font-semibold text-[#222222]">
          {streak}-day streak
        </span>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-[#EBEBEB]">
            <div
              className="h-full rounded-full bg-[#D0103A] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-sm text-[#717171]">
          {points.toLocaleString()} pts · Top {percentile}%
        </span>
      </div>
    </div>
  );
}
