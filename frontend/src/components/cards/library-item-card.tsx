import type { BrandLibraryItem } from "@/types/brand-library";

const TYPE_ICONS: Record<string, string> = {
  poster: "◻",
  whatsapp_card: "✉",
  reel: "▶",
  video: "▶",
  story: "◻",
  deck: "📋",
  infographic: "📊",
  slide_deck: "📋",
};

const TYPE_BG: Record<string, string> = {
  poster: "bg-violet-600",
  whatsapp_card: "bg-red-600",
  reel: "bg-emerald-600",
  video: "bg-emerald-600",
  story: "bg-amber-600",
  deck: "bg-slate-700",
  infographic: "bg-cyan-600",
  slide_deck: "bg-slate-700",
};

interface LibraryItemCardProps {
  item: BrandLibraryItem;
  isAdmin?: boolean;
  onRemix?: () => void;
  onManage?: () => void;
}

export function LibraryItemCard({
  item,
  isAdmin = false,
  onRemix,
  onManage,
}: LibraryItemCardProps) {
  const icon = TYPE_ICONS[item.artifact.type] || "◻";
  const bg = TYPE_BG[item.artifact.type] || "bg-violet-600";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-[#EBEBEB] bg-white p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
      {/* Thumbnail */}
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-lg text-white ${bg}`}
      >
        {icon}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[#222222]">
          {item.artifact.name}
        </p>
        <p className="mt-0.5 text-sm text-[#717171]">
          {item.artifact.product || item.artifact.type} · {item.remix_count} remixes
        </p>
        <div className="mt-2 flex gap-1.5">
          {!isAdmin && (
            <span className="rounded-full bg-[#F0FFF0] px-2.5 py-0.5 text-[11px] font-semibold text-[#008A05]">
              Official · Compliant
            </span>
          )}
          {isAdmin && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                item.status === "published"
                  ? "bg-[#F0FFF0] text-[#008A05]"
                  : item.status === "pending_review"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-[#FFF0F3] text-[#D0103A]"
              }`}
            >
              {item.status.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      {isAdmin ? (
        <button
          onClick={onManage}
          className="shrink-0 rounded-lg border border-[#222222] px-4 py-2 text-sm font-semibold text-[#222222] transition-colors hover:bg-[#F7F7F7]"
        >
          Manage
        </button>
      ) : (
        <button
          onClick={onRemix}
          className="shrink-0 rounded-lg bg-[#D0103A] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#B80E33]"
        >
          Remix →
        </button>
      )}
    </div>
  );
}
