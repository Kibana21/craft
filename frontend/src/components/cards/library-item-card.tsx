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

const TYPE_COLORS: Record<string, string> = {
  poster: "#534AB7",
  whatsapp_card: "#D0103A",
  reel: "#1B9D74",
  video: "#1B9D74",
  story: "#BA7517",
  deck: "#1C3044",
  infographic: "#0891B2",
  slide_deck: "#1C3044",
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
  const color = TYPE_COLORS[item.artifact.type] || "#534AB7";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#E2DDD4] bg-white px-3 py-2.5 transition-colors hover:border-[#AFA9EC]">
      {/* Thumbnail */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[#1A1A18]">
          {item.artifact.name}
        </p>
        <p className="text-[9px] text-[#9C9A92]">
          {item.artifact.product || item.artifact.type} · {item.remix_count} remixes
        </p>
        {!isAdmin && (
          <span className="mt-0.5 inline-block rounded-full border border-[#AFA9EC] bg-[#EEEDFE] px-2 py-0 text-[8px] font-bold text-[#3C3489]">
            Official · Compliant
          </span>
        )}
        {isAdmin && (
          <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0 text-[8px] font-bold ${
              item.status === "published"
                ? "border border-[#9FE1CB] bg-[#E8F6F1] text-[#0E6B50]"
                : item.status === "pending_review"
                  ? "border border-[#FAC775] bg-[#FFFBF0] text-[#854F0B]"
                  : "border border-[#F9C6D0] bg-[#FFF0F3] text-[#D0103A]"
            }`}
          >
            {item.status.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Action */}
      {isAdmin ? (
        <button
          onClick={onManage}
          className="shrink-0 text-[10px] font-semibold text-[#D0103A]"
        >
          Manage
        </button>
      ) : (
        <button
          onClick={onRemix}
          className="shrink-0 text-[10px] font-semibold text-[#D0103A]"
        >
          Remix →
        </button>
      )}
    </div>
  );
}
