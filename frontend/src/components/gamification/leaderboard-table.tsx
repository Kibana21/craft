"use client";

import type { LeaderboardEntry } from "@/types/gamification";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userRank: number | null;
}

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardTable({ entries, userEntry, userRank }: LeaderboardTableProps) {
  const showUserSeparate =
    userEntry && !entries.some((e) => e.is_current_user);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_80px_80px] gap-4 border-b border-[#EBEBEB] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#AAAAAA]">
        <span>#</span>
        <span>Agent</span>
        <span className="text-right">Points</span>
        <span className="text-right">Streak</span>
      </div>

      {entries.map((entry) => (
        <LeaderboardRow key={entry.user_id} entry={entry} />
      ))}

      {/* Current user outside top N */}
      {showUserSeparate && userEntry && (
        <>
          <div className="flex items-center justify-center py-2 text-xs text-[#AAAAAA]">
            · · ·
          </div>
          <LeaderboardRow entry={userEntry} />
        </>
      )}
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const rankIcon = RANK_ICONS[entry.rank];
  const initials = entry.user_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={`grid grid-cols-[40px_1fr_80px_80px] items-center gap-4 px-6 py-4 transition-colors ${
        entry.is_current_user ? "bg-[#FFF0F3]" : "hover:bg-[#F7F7F7]"
      }`}
    >
      {/* Rank */}
      <span className={`text-center text-sm font-bold ${entry.rank <= 3 ? "text-lg" : "text-[#717171]"}`}>
        {rankIcon || entry.rank}
      </span>

      {/* User */}
      <div className="flex items-center gap-3 min-w-0">
        {entry.user_avatar ? (
          <img
            src={entry.user_avatar}
            alt={entry.user_name}
            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#222222] text-xs font-bold text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${entry.is_current_user ? "text-[#D0103A]" : "text-[#222222]"}`}>
            {entry.user_name}
            {entry.is_current_user && (
              <span className="ml-1.5 text-xs font-normal text-[#D0103A]">(you)</span>
            )}
          </p>
        </div>
      </div>

      {/* Points */}
      <p className="text-right text-sm font-bold text-[#222222]">
        {entry.points.toLocaleString()}
      </p>

      {/* Streak */}
      <p className="text-right text-sm text-[#717171]">
        {entry.streak > 0 ? `🔥 ${entry.streak}` : "—"}
      </p>
    </div>
  );
}
