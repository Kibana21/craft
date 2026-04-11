"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchArtifactDetail, updateArtifact } from "@/lib/api/artifacts";
import { ExportDialog } from "@/components/artifacts/export-dialog";
import { CommentThread } from "@/components/artifacts/comment-thread";
import type { ArtifactDetail } from "@/types/artifact";

const TYPE_ICONS: Record<string, string> = {
  poster: "◻", whatsapp_card: "✉", reel: "▶", video: "▶",
  story: "◻", infographic: "📊", slide_deck: "📋",
};
const TYPE_BG: Record<string, string> = {
  poster: "from-violet-600 to-violet-500",
  whatsapp_card: "from-red-600 to-rose-500",
  reel: "from-emerald-600 to-teal-500",
  video: "from-emerald-600 to-teal-500",
  story: "from-amber-600 to-orange-500",
  infographic: "from-cyan-600 to-blue-500",
  slide_deck: "from-slate-700 to-slate-600",
};

function ComplianceBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="flex h-9 items-center gap-1.5 rounded-full bg-[#F7F7F7] px-3 text-xs font-semibold text-[#717171]">
        ⏳ Scoring...
      </span>
    );
  }
  const color =
    score >= 90
      ? "bg-[#008A05] text-white"
      : score >= 70
        ? "bg-amber-500 text-white"
        : "bg-[#D0103A] text-white";
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${color}`}>
      {Math.round(score)}
    </span>
  );
}

export default function ArtifactDetailPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showExport, setShowExport] = useState(false);

  const LEADER_ROLES = ["district_leader", "agency_leader", "brand_admin"];
  const canComment = user ? LEADER_ROLES.includes(user.role) : false;

  useEffect(() => {
    if (artifactId) {
      fetchArtifactDetail(artifactId)
        .then(setArtifact)
        .catch(() => router.push(`/projects/${projectId}`))
        .finally(() => setIsLoading(false));
    }
  }, [artifactId, projectId, router]);

  const handleSaveField = async (field: string, value: string) => {
    if (!artifact) return;
    const newContent = { ...(artifact.content || {}), [field]: value };
    const updated = await updateArtifact(artifact.id, { content: newContent });
    setArtifact(updated);
    setEditingField(null);
  };

  if (isLoading || !artifact) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#F7F7F7]" />
        <div className="mt-6 h-96 animate-pulse rounded-xl bg-[#F7F7F7]" />
      </div>
    );
  }

  const content = artifact.content || {};
  const locks = artifact.locks || [];
  const isLocked = (field: string) => locks.includes(field);
  const gradient = TYPE_BG[artifact.type] || TYPE_BG.poster;
  const icon = TYPE_ICONS[artifact.type] || "◻";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-3 py-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:border-[#DADCE0] hover:bg-[#F1F3F4] hover:text-[#1F1F1F]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4L6 8l4 4" />
          </svg>
          Back to project
        </button>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Left — Preview */}
        <div className="col-span-2">
          <div className={`overflow-hidden rounded-xl bg-gradient-to-br ${gradient}`}>
            <div className="flex h-80 flex-col items-center justify-center p-10 text-center text-white">
              <span className="text-5xl opacity-40">{icon}</span>
              <p className="mt-6 text-2xl font-bold">
                {(content.headline as string) || artifact.name}
              </p>
              {content.message ? (
                <p className="mt-3 max-w-md text-sm opacity-80">
                  {String(content.message)}
                </p>
              ) : null}
              <p className="mt-4 text-xs uppercase tracking-wider opacity-50">
                {String(content.product || "")} · {artifact.type.replace("_", " ")} · {artifact.format || ""}
              </p>
            </div>
          </div>

          {/* Reel storyboard frames */}
          {artifact.type === "reel" && Array.isArray(content.frames) && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-[#484848]">
                Storyboard — {(content.frames as unknown[]).length} frames
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {(content.frames as Array<{ frame_number: number; text_overlay: string; duration_seconds: number; visual_description: string }>).map((frame, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#EBEBEB] bg-white p-4"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-[#B0B0B0]">
                      <span>Frame {frame.frame_number}</span>
                      <span>{frame.duration_seconds}s</span>
                    </div>
                    <p className="text-sm font-semibold text-[#222222]">
                      {frame.text_overlay}
                    </p>
                    <p className="mt-1 text-xs text-[#717171]">
                      {frame.visual_description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Details + Edit */}
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-lg font-bold text-[#222222]">{artifact.name}</h1>
              <ComplianceBadge score={artifact.compliance_score} />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-medium text-[#484848]">
                {artifact.type.replace("_", " ")}
              </span>
              {artifact.channel && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {artifact.channel}
                </span>
              )}
              {artifact.format && (
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  {artifact.format}
                </span>
              )}
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                artifact.status === "draft"
                  ? "bg-[#F7F7F7] text-[#717171]"
                  : artifact.status === "ready"
                    ? "bg-[#F0FFF0] text-[#008A05]"
                    : "bg-amber-50 text-amber-700"
              }`}>
                {artifact.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-[#B0B0B0]">
              Created by {artifact.creator.name} · v{artifact.version}
            </p>
          </div>

          {/* Editable fields */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-[#484848]">
              Content
            </h3>
            <div className="space-y-4">
              {Object.entries(content)
                .filter(([key]) => !["locks", "remixed_from", "frames", "formats", "type", "format"].includes(key))
                .map(([key, value]) => {
                  const locked = isLocked(key);
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-[#B0B0B0]">
                          {key.replace(/_/g, " ")}
                        </span>
                        {locked && (
                          <span className="text-[10px] text-[#B0B0B0]">🔒 Locked</span>
                        )}
                      </div>
                      {editingField === key && !locked ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 rounded-lg border border-[#DDDDDD] px-3 py-2 text-sm focus:border-[#222222] focus:outline-none focus:ring-0"
                          />
                          <button
                            onClick={() => handleSaveField(key, editValue)}
                            className="rounded-lg bg-[#D0103A] px-3 py-2 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingField(null)}
                            className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs text-[#717171]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!locked) {
                              setEditingField(key);
                              setEditValue(String(value));
                            }
                          }}
                          disabled={locked}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            locked
                              ? "cursor-not-allowed border-[#F7F7F7] bg-[#F7F7F7] text-[#B0B0B0]"
                              : "border-[#EBEBEB] bg-white text-[#484848] hover:border-[#DDDDDD]"
                          }`}
                        >
                          {String(value)}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={() => setShowExport(true)}
            className="w-full rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]"
          >
            Export artifact →
          </button>

          {/* Comments */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
            <CommentThread
              artifactId={artifact.id}
              canComment={canComment}
            />
          </div>
        </div>
      </div>

      {/* Export dialog */}
      {showExport && (
        <ExportDialog
          artifactId={artifact.id}
          artifactType={artifact.type}
          artifactName={artifact.name}
          complianceScore={artifact.compliance_score}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
