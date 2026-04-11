"use client";

const MILESTONES = [
  { threshold: 0, label: "Bronze Creator", color: "#CD7F32" },
  { threshold: 500, label: "Silver Creator", color: "#C0C0C0" },
  { threshold: 2000, label: "Gold Creator", color: "#FFD700" },
  { threshold: 5000, label: "Platinum Creator", color: "#E5E4E2" },
  { threshold: 10000, label: "Diamond Creator", color: "#B9F2FF" },
];

interface PointsProgressProps {
  points: number;
  nextMilestone: number;
  currentLevel: string;
  compact?: boolean;
}

export function PointsProgress({
  points,
  nextMilestone,
  currentLevel,
  compact = false,
}: PointsProgressProps) {
  const current = MILESTONES.find((m) => m.label === currentLevel) || MILESTONES[0];
  const progress =
    nextMilestone > current.threshold
      ? Math.min(100, ((points - current.threshold) / (nextMilestone - current.threshold)) * 100)
      : 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-[#EBEBEB]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: current.color }}
            />
          </div>
        </div>
        <span className="text-xs text-[#717171]">
          {points.toLocaleString()} / {nextMilestone.toLocaleString()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: current.color }}
          />
          <span className="text-sm font-semibold text-[#222222]">{currentLevel}</span>
        </div>
        <span className="text-xs text-[#717171]">
          {points.toLocaleString()} pts
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EBEBEB]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, backgroundColor: current.color }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#717171]">
        <span>{points.toLocaleString()}</span>
        <span>{nextMilestone.toLocaleString()} for next level</span>
      </div>
    </div>
  );
}
