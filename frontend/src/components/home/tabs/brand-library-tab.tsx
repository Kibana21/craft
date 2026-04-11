"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { LibraryItemCard } from "@/components/cards/library-item-card";
import { fetchLibraryItems, remixLibraryItem } from "@/lib/api/brand-library";
import type { BrandLibraryItem } from "@/types/brand-library";

export function BrandLibraryTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BrandLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    fetchLibraryItems()
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl border border-[#E8EAED] bg-[#F8F9FA]" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[#1F1F1F]">Brand library</h2>
        <button
          onClick={() => router.push("/brand-library")}
          className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] px-3.5 py-1.5 text-[13px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]"
        >
          {isAdmin ? "Manage library" : "Browse all"}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <LibraryItemCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            onRemix={async () => {
              const result = await remixLibraryItem(item.id);
              router.push(`/projects/${result.project_id}`);
            }}
            onManage={() => router.push(`/brand-library/${item.id}`)}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="mt-20 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F3F4] text-2xl">📚</div>
          <p className="text-[15px] font-medium text-[#1F1F1F]">
            {isAdmin ? "Brand Library is empty" : "Nothing here yet"}
          </p>
          <p className="mt-1 text-[13px] text-[#80868B]">
            {isAdmin ? "Publish your first artifact for FSCs to remix" : "Your brand team will publish content here soon"}
          </p>
        </div>
      )}
    </div>
  );
}
