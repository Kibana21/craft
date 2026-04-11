"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { LibraryItemCard } from "@/components/cards/library-item-card";
import { fetchLibraryItems, remixLibraryItem } from "@/lib/api/brand-library";
import type { BrandLibraryItem } from "@/types/brand-library";

const AIA_PRODUCTS = [
  "All products",
  "PAA",
  "HealthShield",
  "AIA Vitality",
  "PRUWealth",
  "AIA Family Protect",
  "SG60 Special",
];

export default function BrandLibraryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BrandLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [isRemixing, setIsRemixing] = useState<string | null>(null);

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    setIsLoading(true);
    fetchLibraryItems({
      search: search || undefined,
      product: product || undefined,
    })
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [search, product]);

  const handleRemix = async (itemId: string) => {
    setIsRemixing(itemId);
    try {
      const result = await remixLibraryItem(itemId);
      router.push(`/projects/${result.project_id}`);
    } catch {
      setIsRemixing(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#222222]">Brand Library</h1>
          <p className="mt-1 text-base text-[#717171]">
            {isAdmin
              ? "Manage approved content for FSCs to remix"
              : "Official AIA content — compliant and brand-locked. Remix any item into your own project."}
          </p>
        </div>
        {isAdmin && (
          <button className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]">
            + Publish new
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search library items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
          />
        </div>
        <div className="flex gap-2">
          {AIA_PRODUCTS.map((p) => (
            <button
              key={p}
              onClick={() => setProduct(p === "All products" ? "" : p)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                (p === "All products" && !product) || product === p
                  ? "bg-[#222222] text-white"
                  : "bg-white border border-[#DDDDDD] text-[#484848] hover:border-[#222222]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F7F7F7]" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <LibraryItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onRemix={() => handleRemix(item.id)}
              onManage={() => router.push(`/brand-library/${item.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
            📚
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#222222]">
            {search || product ? "No matching items" : "Brand Library is empty"}
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
