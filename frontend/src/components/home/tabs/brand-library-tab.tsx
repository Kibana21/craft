"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { LibraryItemCard } from "@/components/cards/library-item-card";
import { fetchLibraryItems } from "@/lib/api/brand-library";
import type { BrandLibraryItem } from "@/types/brand-library";

export function BrandLibraryTab() {
  const { user } = useAuth();
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
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-[#E2DDD4]"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-[#1A1A18]">Brand Library</h3>
        {isAdmin ? (
          <button className="text-[10px] text-[#D0103A]">+ Publish new</button>
        ) : (
          <button className="text-[10px] text-[#D0103A]">Browse all →</button>
        )}
      </div>
      <p className="mb-3 text-[10px] text-[#9C9A92]">
        {isAdmin
          ? "Manage what gets published for FSCs to remix"
          : "Official AIA content — compliant and brand-locked. Remix any item into your own project."}
      </p>

      <div className="space-y-2">
        {items.map((item) => (
          <LibraryItemCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="mt-4 text-center">
          <p className="text-2xl">📚</p>
          <p className="mt-2 text-[11px] text-[#9C9A92]">
            {isAdmin
              ? "No items in the Brand Library yet — publish your first artifact"
              : "No content in the Brand Library yet — check back soon"}
          </p>
        </div>
      )}
    </div>
  );
}
