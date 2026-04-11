"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectPurposeBadge } from "@/components/projects/project-purpose-badge";
import { fetchProjectDetail, type ProjectDetail } from "@/lib/api/projects";
import { fetchSuggestions } from "@/lib/api/suggestions";
import { fetchMembers, type ProjectMember } from "@/lib/api/members";
import type { ArtifactSuggestion } from "@/types/suggestion";
import { isCreatorRole } from "@/lib/auth";

const TYPE_ICONS: Record<string, string> = {
  video: "▶", poster: "◻", whatsapp_card: "✉", reel: "▶",
  story: "◻", infographic: "📊", slide_deck: "📋",
};
const TYPE_BG: Record<string, string> = {
  video: "bg-emerald-600", poster: "bg-violet-600", whatsapp_card: "bg-red-600",
  reel: "bg-emerald-600", story: "bg-amber-600", infographic: "bg-cyan-600", slide_deck: "bg-slate-700",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [suggestions, setSuggestions] = useState<ArtifactSuggestion[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchProjectDetail(id),
      fetchSuggestions(id),
      fetchMembers(id).catch(() => []),
    ])
      .then(([proj, sugs, mems]) => {
        setProject(proj);
        setSuggestions(sugs);
        setMembers(mems);
      })
      .catch(() => router.push("/home"))
      .finally(() => setIsLoading(false));
  }, [id, router]);

  if (isLoading || !project || !user) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#F7F7F7]" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-[#F7F7F7]" />
      </div>
    );
  }

  const isTeam = project.type === "team";
  const isOwner = project.owner.id === user.id;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => router.push("/home")}
              className="text-sm text-[#717171] hover:text-[#222222]"
            >
              ← Back
            </button>
            <ProjectPurposeBadge purpose={project.purpose} />
            {isTeam && (
              <span className="rounded-full bg-[#F0FFF0] px-3 py-1 text-xs font-semibold text-[#008A05]">
                Team · {project.member_count} members
              </span>
            )}
          </div>
          <h1 className="text-[28px] font-bold text-[#222222]">{project.name}</h1>
          <p className="mt-1 text-base text-[#717171]">
            by {project.owner.name}
          </p>
        </div>
        <button
          onClick={() => router.push(`/projects/${project.id}/artifacts/new`)}
          className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]"
        >
          + New artifact
        </button>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Left column — Brief + Brand Kit */}
        <div className="col-span-2 space-y-6">
          {/* Brief panel */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-[#222222]">
              Campaign brief
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {project.product && (
                <div>
                  <p className="text-xs font-medium text-[#B0B0B0]">Product</p>
                  <p className="mt-0.5 text-sm font-medium text-[#222222]">
                    {project.product}
                  </p>
                </div>
              )}
              {project.target_audience && (
                <div>
                  <p className="text-xs font-medium text-[#B0B0B0]">Audience</p>
                  <p className="mt-0.5 text-sm font-medium text-[#222222]">
                    {project.target_audience}
                  </p>
                </div>
              )}
              {project.campaign_period && (
                <div>
                  <p className="text-xs font-medium text-[#B0B0B0]">Period</p>
                  <p className="mt-0.5 text-sm font-medium text-[#222222]">
                    {project.campaign_period}
                  </p>
                </div>
              )}
              {project.brand_kit_id && (
                <div>
                  <p className="text-xs font-medium text-[#B0B0B0]">Brand kit</p>
                  <p className="mt-0.5 text-sm font-medium text-[#008A05]">
                    Active
                  </p>
                </div>
              )}
            </div>
            {project.key_message && (
              <div className="mt-4 rounded-xl bg-[#F7F7F7] p-4">
                <p className="text-xs font-medium text-[#B0B0B0]">
                  Key message
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#484848]">
                  {project.key_message}
                </p>
              </div>
            )}
          </div>

          {/* CRAFT suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#222222]">
                  CRAFT suggests
                </h2>
                <span className="text-sm text-[#717171]">
                  {suggestions.filter((s) => s.selected).length} of{" "}
                  {suggestions.length} selected
                </span>
              </div>
              <div className="space-y-3">
                {suggestions
                  .filter((s) => s.selected)
                  .map((suggestion) => {
                    const icon = TYPE_ICONS[suggestion.artifact_type] || "◻";
                    const bg = TYPE_BG[suggestion.artifact_type] || "bg-violet-600";

                    return (
                      <div
                        key={suggestion.id}
                        className="group flex items-center gap-4 rounded-xl border border-[#EBEBEB] bg-white p-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${bg}`}>
                          {icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#222222]">
                            {suggestion.artifact_name}
                          </p>
                          <p className="text-xs text-[#717171]">
                            {suggestion.description}
                          </p>
                        </div>
                        <button className="rounded-lg bg-[#F7F7F7] px-4 py-2 text-sm font-semibold text-[#484848] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#EBEBEB]">
                          Start creating →
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Artifacts grid — placeholder for now */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-[#222222]">
              Artifacts
            </h2>
            <div className="text-center py-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
                🎨
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#222222]">
                No artifacts yet
              </h3>
              <p className="mt-1 text-sm text-[#717171]">
                Start creating from a suggestion above, or add a new artifact
              </p>
            </div>
          </div>
        </div>

        {/* Right column — Members + Stats */}
        <div className="space-y-6">
          {/* Members */}
          {isTeam && (
            <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#222222]">
                  Members
                </h2>
                {isOwner && (
                  <button className="text-sm font-semibold text-[#D0103A]">
                    + Invite
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {members.map((member) => {
                  const initials = member.user_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("");
                  return (
                    <div key={member.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F7F7] text-xs font-bold text-[#484848]">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#222222]">
                          {member.user_name}
                        </p>
                        <p className="text-xs text-[#B0B0B0]">
                          {member.user_role.replace("_", " ")}
                        </p>
                      </div>
                      {member.role === "owner" && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Owner
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project stats */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-[#222222]">
              Project stats
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#717171]">Artifacts</span>
                <span className="text-sm font-semibold text-[#222222]">
                  {project.artifact_count}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#717171]">Suggestions</span>
                <span className="text-sm font-semibold text-[#222222]">
                  {project.suggestion_count}
                </span>
              </div>
              {isTeam && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#717171]">Members</span>
                  <span className="text-sm font-semibold text-[#222222]">
                    {project.member_count}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#717171]">Status</span>
                <span className="rounded-full bg-[#F0FFF0] px-2.5 py-0.5 text-xs font-semibold text-[#008A05]">
                  {project.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
