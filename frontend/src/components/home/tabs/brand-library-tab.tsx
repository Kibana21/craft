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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-[#F7F7F7]"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#222222]">
            Brand Library
          </h2>
          <p className="mt-0.5 text-sm text-[#717171]">
            {isAdmin
              ? "Manage what gets published for FSCs to remix"
              : "Official AIA content — compliant and brand-locked. Remix any item."}
          </p>
        </div>
        {isAdmin ? (
          <button
            onClick={() => router.push("/brand-library")}
            className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]"
          >
            Manage library →
          </button>
        ) : (
          <button
            onClick={() => router.push("/brand-library")}
            className="rounded-lg border border-[#222222] px-6 py-3 text-base font-semibold text-[#222222] transition-colors hover:bg-[#F7F7F7]"
          >
            Browse all →
          </button>
        )}
      </div>

      <div className="space-y-4">
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
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
            📚
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#222222]">
            {isAdmin ? "Brand Library is empty" : "Nothing here yet"}
          </h3>
          <p className="mt-1 text-sm text-[#717171]">
            {isAdmin
              ? "Publish your first artifact for FSCs to remix"
              : "Your brand team will publish content here soon"}
          </p>
        </div>
      )}
    </div>
  );
}
