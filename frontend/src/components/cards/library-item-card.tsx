import type { BrandLibraryItem } from "@/types/brand-library";

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

interface LibraryItemCardProps {
  item: BrandLibraryItem;
  isAdmin?: boolean;
  onRemix?: () => void;
  onManage?: () => void;
}

export function LibraryItemCard({ item, isAdmin = false, onRemix, onManage }: LibraryItemCardProps) {
  const config = TYPE_CONFIG[item.artifact.type] || { emoji: "📄", bg: "#F1F3F4" };

  const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    published:      { label: "Published",      className: "bg-[#E6F4EA] text-[#188038]" },
    approved:       { label: "Approved",       className: "bg-[#E6F4EA] text-[#188038]" },
    pending_review: { label: "Pending review", className: "bg-[#FEF7E0] text-[#B45309]" },
    rejected:       { label: "Rejected",       className: "bg-[#FCE8E6] text-[#C5221F]" },
  };
  const statusConfig = STATUS_CONFIG[item.status] ?? { label: item.status, className: "bg-[#F1F3F4] text-[#5F6368]" };

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-[#E8EAED] bg-white px-4 py-3.5 transition-all hover:border-[#DADCE0] hover:shadow-[0_1px_4px_rgba(32,33,36,0.08)]">
      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: config.bg }}
      >
        {config.emoji}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[#1F1F1F]">
          {item.artifact.name}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12px] text-[#80868B]">
            {item.artifact.product || item.artifact.type} · {item.remix_count} remixes
          </span>
          {isAdmin ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusConfig.className}`}>
              {statusConfig.label}
            </span>
          ) : (
            <span className="rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[11px] font-medium text-[#188038]">
              Compliant
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      {isAdmin ? (
        <button
          onClick={onManage}
          className="shrink-0 rounded-full border border-[#DADCE0] px-3.5 py-1.5 text-[12px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]"
        >
          Manage
        </button>
      ) : (
        <button
          onClick={onRemix}
          className="shrink-0 rounded-full bg-[#D0103A] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#B80E33]"
        >
          Remix
        </button>
      )}
    </div>
  );
}
