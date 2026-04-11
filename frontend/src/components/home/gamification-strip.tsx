"use client";

export function GamificationStrip() {
  // Placeholder data — real data wired in Phase 8
  const streak = 5;
  const points = 2847;
  const percentile = 12;
  const progress = 68;

  return (
    <div className="border-t border-[#FAC775] bg-[#FFFBF0] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm">🔥</span>
        <span className="text-[10px] font-semibold text-[#854F0B]">
          {streak}-day streak
        </span>
        <div className="flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-[#F0EDE6]">
            <div
              className="h-full rounded-full bg-[#BA7517]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] text-[#9C9A92]">
          {points.toLocaleString()} pts · Top {percentile}%
        </span>
      </div>
    </div>
  );
}
