import type { BrandLibraryItem } from "@/types/brand-library";
import { badge, btn, card } from "@/lib/ui";

const TYPE_CONFIG: Record<string, { emoji: string; bg: string }> = {
  poster:        { emoji: "🖼️", bg: "#F3E8FD" },
  whatsapp_card: { emoji: "💬", bg: "#E6F4EA" },
  reel:          { emoji: "🎬", bg: "#E8F0FE" },
  video:         { emoji: "▶️", bg: "#E8F0FE" },
  story:         { emoji: "📱", bg: "#FEF7E0" },
  deck:          { emoji: "📋", bg: "#F1F3F4" },
  infographic:   { emoji: "📊", bg: "#FCE8E6" },
  slide_deck:    { emoji: "🗂️", bg: "#F1F3F4" },
};

const STATUS_BADGE: Record<string, string> = {
  published:      badge.green,
  approved:       badge.green,
  pending_review: badge.amber,
  rejected:       badge.red,
};

const STATUS_LABEL: Record<string, string> = {
  published:      "Published",
  approved:       "Approved",
  pending_review: "Pending review",
  rejected:       "Rejected",
};

interface LibraryItemCardProps {
  item: BrandLibraryItem;
  isAdmin?: boolean;
  onRemix?: () => void;
  onManage?: () => void;
}

export function LibraryItemCard({ item, isAdmin = false, onRemix, onManage }: LibraryItemCardProps) {
  const config = TYPE_CONFIG[item.artifact.type] ?? { emoji: "📄", bg: "#F1F3F4" };

  return (
    <div className={card.row}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: config.bg }}>
        {config.emoji}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[#1F1F1F]">{item.artifact.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12px] text-[#80868B]">
            {item.artifact.product || item.artifact.type} · {item.remix_count} remixes
          </span>
          {isAdmin ? (
            <span className={STATUS_BADGE[item.status] ?? badge.grey}>
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
          ) : (
            <span className={badge.green}>Compliant</span>
          )}
        </div>
      </div>

      {isAdmin ? (
        <button onClick={onManage} className={btn.outline}>Manage</button>
      ) : (
        <button onClick={onRemix} className={btn.brand}>Remix</button>
      )}
    </div>
  );
}
