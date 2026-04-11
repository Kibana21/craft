"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import {
  fetchLibraryItemDetail,
  reviewLibraryItem,
  remixLibraryItem,
  type BrandLibraryDetailItem,
} from "@/lib/api/brand-library";

const TYPE_ICONS: Record<string, string> = {
  poster: "◻", whatsapp_card: "✉", reel: "▶", video: "▶",
  story: "◻", deck: "📋", infographic: "📊", slide_deck: "📋",
};
const TYPE_BG: Record<string, string> = {
  poster: "bg-violet-600", whatsapp_card: "bg-red-600", reel: "bg-emerald-600",
  video: "bg-emerald-600", story: "bg-amber-600", deck: "bg-slate-700",
  infographic: "bg-cyan-600", slide_deck: "bg-slate-700",
};

export default function LibraryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<BrandLibraryDetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    if (!id) return;
    fetchLibraryItemDetail(id)
      .then(setItem)
      .catch(() => router.push("/brand-library"))
      .finally(() => setIsLoading(false));
  }, [id, router]);

  const handleApprove = async () => {
    if (!item) return;
    setIsActing(true);
    try {
      const updated = await reviewLibraryItem(item.id, "approve");
      setItem(updated);
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!item) return;
    setIsActing(true);
    try {
      const updated = await reviewLibraryItem(item.id, "reject", rejectReason);
      setItem(updated);
      setShowReject(false);
    } finally {
      setIsActing(false);
    }
  };

  const handleRemix = async () => {
    if (!item) return;
    setIsActing(true);
    try {
      const result = await remixLibraryItem(item.id);
      router.push(`/projects/${result.project_id}`);
    } catch {
      setIsActing(false);
    }
  };

  if (isLoading || !item) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#F7F7F7]" />
        <div className="mt-6 h-96 animate-pulse rounded-xl bg-[#F7F7F7]" />
      </div>
    );
  }

  const icon = TYPE_ICONS[item.artifact.type] || "◻";
  const bg = TYPE_BG[item.artifact.type] || "bg-violet-600";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Back */}
      <button
        onClick={() => router.push("/brand-library")}
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-3 py-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:border-[#DADCE0] hover:bg-[#F1F3F4] hover:text-[#1F1F1F]"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 4L6 8l4 4" />
        </svg>
        Back to Brand Library
      </button>

      {/* Main card */}
      <div className="overflow-hidden rounded-xl border border-[#EBEBEB] bg-white">
        {/* Preview header */}
        <div className={`flex h-48 items-center justify-center ${bg}`}>
          <span className="text-6xl text-white/40">{icon}</span>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[28px] font-bold text-[#222222]">
                {item.artifact.name}
              </h1>
              <p className="mt-1 text-base text-[#717171]">
                Published by {item.published_by.name} · {item.remix_count} remixes
              </p>
              <div className="mt-3 flex gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === "published"
                      ? "bg-[#F0FFF0] text-[#008A05]"
                      : item.status === "pending_review"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-[#FFF0F3] text-[#D0103A]"
                  }`}
                >
                  {item.status.replace("_", " ")}
                </span>
                <span className="rounded-full bg-[#F0FFF0] px-3 py-1 text-xs font-semibold text-[#008A05]">
                  Official · Compliant
                </span>
                {item.artifact.product && (
                  <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-semibold text-[#484848]">
                    {item.artifact.product}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Artifact content preview */}
          {item.artifact.content && (
            <div className="mt-6 rounded-xl bg-[#F7F7F7] p-5">
              <h3 className="mb-3 text-sm font-semibold text-[#484848]">
                Content details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(item.artifact.content)
                  .filter(([key]) => !["locks", "remixed_from"].includes(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <span className="text-xs font-medium text-[#B0B0B0]">
                        {key.replace(/_/g, " ")}
                      </span>
                      <p className="mt-0.5 text-[#484848]">
                        {String(value)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {item.rejection_reason && (
            <div className="mt-4 rounded-xl border border-red-200 bg-[#FFF0F3] p-4">
              <p className="text-sm font-medium text-[#D0103A]">
                Rejected: {item.rejection_reason}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            {isAdmin && item.status === "pending_review" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isActing}
                  className="rounded-lg bg-[#008A05] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isActing ? "Approving..." : "Approve & Publish"}
                </button>
                <button
                  onClick={() => setShowReject(!showReject)}
                  className="rounded-lg border border-[#D0103A] px-6 py-3 text-base font-semibold text-[#D0103A] transition-colors hover:bg-[#FFF0F3]"
                >
                  Reject
                </button>
              </>
            )}
            {isAdmin && item.status === "published" && (
              <button
                onClick={() =>
                  reviewLibraryItem(item.id, "unpublish").then(setItem)
                }
                className="rounded-lg border border-[#222222] px-6 py-3 text-base font-semibold text-[#222222] transition-colors hover:bg-[#F7F7F7]"
              >
                Unpublish
              </button>
            )}
            {!isAdmin && item.status === "published" && (
              <button
                onClick={handleRemix}
                disabled={isActing}
                className="rounded-lg bg-[#D0103A] px-8 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33] disabled:opacity-50"
              >
                {isActing ? "Creating remix..." : "Remix into my project →"}
              </button>
            )}
          </div>

          {/* Reject form */}
          {showReject && (
            <div className="mt-4 rounded-xl border border-[#EBEBEB] bg-[#F7F7F7] p-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="mb-3 w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base focus:border-[#222222] focus:outline-none focus:ring-0"
              />
              <button
                onClick={handleReject}
                disabled={isActing || !rejectReason.trim()}
                className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33] disabled:opacity-50"
              >
                Confirm rejection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
