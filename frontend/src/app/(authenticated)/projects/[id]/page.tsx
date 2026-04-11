"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectPurposeBadge } from "@/components/projects/project-purpose-badge";
import { fetchProjectDetail, setProjectStatus, deleteProject, type ProjectDetail } from "@/lib/api/projects";
import { fetchSuggestions } from "@/lib/api/suggestions";
import { fetchProjectArtifacts } from "@/lib/api/artifacts";
import { fetchMembers, type ProjectMember } from "@/lib/api/members";
import type { ArtifactSuggestion } from "@/types/suggestion";
import type { Artifact } from "@/types/artifact";
import { isCreatorRole } from "@/lib/auth";
import { badge, tab } from "@/lib/ui";

const TYPE_META: Record<string, { icon: string; bg: string; label: string }> = {
  video:         { icon: "▶",  bg: "bg-emerald-600", label: "Videos" },
  poster:        { icon: "◻",  bg: "bg-violet-600",  label: "Posters" },
  whatsapp_card: { icon: "✉",  bg: "bg-red-600",     label: "WhatsApp Cards" },
  reel:          { icon: "▶",  bg: "bg-emerald-600", label: "Reels" },
  story:         { icon: "◻",  bg: "bg-amber-600",   label: "Stories" },
  infographic:   { icon: "📊", bg: "bg-cyan-600",    label: "Infographics" },
  slide_deck:    { icon: "📋", bg: "bg-slate-700",   label: "Slide Decks" },
};
const STATUS_BADGE: Record<string, string> = {
  draft: badge.grey, ready: badge.green, exported: badge.green,
};
const SORT_LABELS: Record<string, string> = {
  recent: "Most recent", name: "Name (A–Z)", oldest: "Oldest first",
};

type TabId = "artifacts" | "suggestions" | "brief" | "members";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject]         = useState<ProjectDetail | null>(null);
  const [suggestions, setSuggestions] = useState<ArtifactSuggestion[]>([]);
  const [artifacts, setArtifacts]     = useState<Artifact[]>([]);
  const [members, setMembers]         = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [activeTab, setActiveTab]     = useState<TabId>("brief");
  const [view, setView]               = useState<"grid" | "list">("grid");
  const [sort, setSort]               = useState<"recent" | "name" | "oldest">("recent");
  const [sortOpen, setSortOpen]       = useState(false);
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({});
  const [showDelete, setShowDelete]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isActing, setIsActing]       = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchProjectDetail(id),
      fetchSuggestions(id),
      fetchProjectArtifacts(id).catch(() => ({ items: [], total: 0, page: 1, per_page: 20 })),
      fetchMembers(id).catch(() => []),
    ])
      .then(([proj, sugs, arts, mems]) => {
        setProject(proj);
        setSuggestions(sugs);
        setArtifacts(arts.items);
        setMembers(mems);
      })
      .catch(() => router.push("/home"))
      .finally(() => setIsLoading(false));
  }, [id, router]);

  const sortedArtifacts = useMemo(() => {
    return [...artifacts].sort((a, b) => {
      if (sort === "name")   return a.name.localeCompare(b.name);
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [artifacts, sort]);

  const groupedArtifacts = useMemo(() => {
    const groups: Record<string, Artifact[]> = {};
    for (const a of sortedArtifacts) {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    }
    return groups;
  }, [sortedArtifacts]);

  if (isLoading || !project || !user) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="h-5 w-24 animate-pulse rounded-full bg-[#F1F3F4]" />
        <div className="mt-3 h-7 w-56 animate-pulse rounded-lg bg-[#F1F3F4]" />
        <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-[#F1F3F4]" />
        <div className="mt-4 grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[#F1F3F4]" />
          ))}
        </div>
      </div>
    );
  }

  const isTeam    = project.type === "team";
  const isOwner   = project.owner.id === user.id;
  const isCreator = isCreatorRole(user.role);
  const canManage = isOwner || isCreator;
  const selectedSuggestions = suggestions.filter((s) => s.selected);

  const handleToggleStatus = async () => {
    setIsActing(true);
    try {
      const newStatus = project.status === "active" ? "archived" : "active";
      const updated = await setProjectStatus(project.id, newStatus);
      if (newStatus === "archived") {
        router.push("/home");
      } else {
        setProject(updated);
        setIsActing(false);
      }
    } catch {
      setIsActing(false);
    }
  };

  const handleDelete = async () => {
    setIsActing(true);
    try {
      await deleteProject(project.id);
      router.push("/home");
    } catch {
      setIsActing(false);
    }
  };

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "brief",       label: "Brief" },
    { id: "artifacts",   label: "Artifacts",   count: artifacts.length },
    { id: "suggestions", label: "Suggestions", count: selectedSuggestions.length },
    ...(isTeam ? [{ id: "members" as TabId, label: "Members", count: members.length }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-5">

      {/* ── Compact header ── */}
      <div className="mb-3 flex items-center gap-2.5">
        <button
          onClick={() => router.push("/home")}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-3 py-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:border-[#DADCE0] hover:bg-[#F1F3F4] hover:text-[#1F1F1F]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4L6 8l4 4" />
          </svg>
          Back
        </button>
        <ProjectPurposeBadge purpose={project.purpose} />
        {isTeam && (
          <span className="rounded-full bg-[#E6F4EA] px-2.5 py-0.5 text-[11px] font-medium text-[#188038]">
            Team · {project.member_count} members
          </span>
        )}
      </div>

      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1F1F1F]">{project.name}</h1>
          <p className="mt-0.5 text-[13px] text-[#80868B]">by {project.owner.name}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleStatus}
              disabled={isActing}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-4 py-2 text-[13px] font-medium text-[#5F6368] transition-colors hover:border-[#DADCE0] hover:bg-[#F1F3F4] hover:text-[#1F1F1F] disabled:opacity-50"
            >
              {project.status === "active" ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Archive
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Restore
                </>
              )}
            </button>
            <button
              onClick={() => { setShowDelete(true); setDeleteConfirm(""); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-4 py-2 text-[13px] font-medium text-[#D0103A] transition-colors hover:border-[#D0103A] hover:bg-[#FFF8F9]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>
            {project.status === "archived" && (
              <span className="rounded-full bg-[#F1F3F4] px-2.5 py-0.5 text-[11px] font-medium text-[#80868B]">Archived</span>
            )}
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF0F3]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D0103A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold text-[#1F1F1F]">Delete &ldquo;{project.name}&rdquo;?</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F6368]">
              This will permanently delete the project and all its artifacts, suggestions, and members. This action cannot be undone.
            </p>
            <p className="mt-4 text-[12px] font-medium text-[#3C4043]">
              Type <span className="font-semibold text-[#1F1F1F]">{project.name}</span> to confirm
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={project.name}
              className="mt-2 w-full rounded-lg border border-[#E8EAED] px-3.5 py-2.5 text-[13px] text-[#1F1F1F] placeholder:text-[#B0B0B0] focus:border-[#D0103A] focus:outline-none"
            />
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 rounded-lg border border-[#E8EAED] py-2.5 text-[13px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== project.name || isActing}
                className="flex-1 rounded-lg bg-[#D0103A] py-2.5 text-[13px] font-medium text-white transition-all hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isActing ? "Deleting..." : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className={tab.root}>
        <div className="flex items-end gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative pb-3.5 pr-6 text-[14px] font-medium transition-colors ${
                activeTab === t.id
                  ? "text-[#1F1F1F] font-semibold"
                  : "text-[#80868B] hover:text-[#3C4043]"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                  activeTab === t.id ? "bg-[#F1F3F4] text-[#3C4043]" : "bg-[#F1F3F4] text-[#80868B]"
                }`}>
                  {t.count}
                </span>
              )}
              {activeTab === t.id && (
                <span className={tab.indicator} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}

      {/* Artifacts tab */}
      {activeTab === "artifacts" && (
        <div>
          {artifacts.length > 0 ? (
            <>
              {/* Toolbar */}
              <div className="mb-5 flex items-center justify-end gap-2">
                {/* View toggle */}
                <div className="flex items-center rounded-full border border-[#E8EAED] bg-white p-1">
                  <button onClick={() => setView("grid")} title="Grid view"
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${view === "grid" ? "bg-[#E8EAED] text-[#1F1F1F]" : "text-[#80868B] hover:text-[#3C4043]"}`}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/>
                      <rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>
                    </svg>
                  </button>
                  <button onClick={() => setView("list")} title="List view"
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${view === "list" ? "bg-[#E8EAED] text-[#1F1F1F]" : "text-[#80868B] hover:text-[#3C4043]"}`}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/>
                    </svg>
                  </button>
                </div>

                {/* Sort */}
                <div className="relative">
                  <button onClick={() => setSortOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-full border border-[#E8EAED] bg-white px-4 py-1.5 text-[13px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]">
                    {SORT_LABELS[sort]}
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4"/></svg>
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#E8EAED] bg-white py-1 shadow-[0_4px_16px_rgba(32,33,36,0.12)]">
                        {(Object.keys(SORT_LABELS) as Array<"recent"|"name"|"oldest">).map((s) => (
                          <button key={s} onClick={() => { setSort(s); setSortOpen(false); }}
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[#F1F3F4] ${sort === s ? "font-medium text-[#1F1F1F]" : "text-[#5F6368]"}`}>
                            {sort === s
                              ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#D0103A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 8 6 12 14 4"/></svg>
                              : <span className="w-[13px]" />}
                            {SORT_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Type groups */}
              <div className="space-y-4">
                {Object.entries(groupedArtifacts).map(([type, items]) => {
                  const meta  = TYPE_META[type] ?? { icon: "◻", bg: "bg-violet-600", label: type };
                  const isCollapsed = collapsed[type];
                  return (
                    <div key={type} className="rounded-xl border border-[#E8EAED] bg-white overflow-hidden">
                      {/* Group header */}
                      <button
                        onClick={() => setCollapsed((c) => ({ ...c, [type]: !c[type] }))}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs text-white ${meta.bg}`}>
                          {meta.icon}
                        </div>
                        <span className="text-[14px] font-medium text-[#1F1F1F]">{meta.label}</span>
                        <span className="rounded-full bg-[#F1F3F4] px-2 py-0.5 text-[11px] font-medium text-[#5F6368]">{items.length}</span>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#80868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`ml-auto transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>
                          <path d="M4 6l4 4 4-4"/>
                        </svg>
                      </button>

                      {/* Group content */}
                      {!isCollapsed && (
                        <div className="border-t border-[#F1F3F4] px-4 pb-4 pt-3">
                          {view === "grid" ? (
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                              {items.map((artifact) => (
                                <button key={artifact.id}
                                  onClick={() => router.push(`/projects/${id}/artifacts/${artifact.id}`)}
                                  className="flex flex-col rounded-xl border border-[#E8EAED] bg-[#FAFAFA] p-3.5 text-left transition-all hover:border-[#DADCE0] hover:bg-white hover:shadow-[0_1px_6px_rgba(32,33,36,0.08)]">
                                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[#1F1F1F]">{artifact.name}</p>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className={STATUS_BADGE[artifact.status] ?? badge.grey}>{artifact.status}</span>
                                    <span className="text-[11px] text-[#80868B]">v{artifact.version}</span>
                                  </div>
                                </button>
                              ))}
                              <button onClick={() => router.push(`/projects/${project.id}/artifacts/new`)}
                                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#DADCE0] p-3.5 text-[#80868B] transition-all hover:border-[#D0103A] hover:bg-[#FFF8F9] hover:text-[#D0103A]"
                                style={{ minHeight: 80 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                <span className="text-[11px] font-medium">New</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {items.map((artifact) => (
                                <button key={artifact.id}
                                  onClick={() => router.push(`/projects/${id}/artifacts/${artifact.id}`)}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#F8F9FA]">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium text-[#1F1F1F]">{artifact.name}</p>
                                  </div>
                                  <span className={STATUS_BADGE[artifact.status] ?? badge.grey}>{artifact.status}</span>
                                  <span className="shrink-0 text-[11px] text-[#80868B]">v{artifact.version}</span>
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#DADCE0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 4l4 4-4 4"/>
                                  </svg>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8EAED] bg-white py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F3F4] text-2xl">🎨</div>
              <p className="mt-3 text-[14px] font-medium text-[#1F1F1F]">No artifacts yet</p>
              <p className="mt-1 text-[13px] text-[#80868B]">Create your first artifact for this project</p>
              <button onClick={() => router.push(`/projects/${project.id}/artifacts/new`)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1F1F1F] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#3C4043]">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>
                </svg>
                New artifact
              </button>
            </div>
          )}
        </div>
      )}

      {/* Suggestions tab */}
      {activeTab === "suggestions" && (
        <div>
          {selectedSuggestions.length > 0 ? (
            <div className="space-y-1.5">
              {selectedSuggestions.map((s) => {
                const meta = TYPE_META[s.artifact_type] ?? { icon: "◻", bg: "bg-violet-600", label: s.artifact_type };
                const icon = meta.icon;
                const bg   = meta.bg;
                return (
                  <div key={s.id} className="group flex items-center gap-3 rounded-xl border border-[#E8EAED] bg-white px-4 py-3 transition-all hover:border-[#DADCE0] hover:shadow-[0_1px_4px_rgba(32,33,36,0.08)]">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white ${bg}`}>{icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#1F1F1F]">{s.artifact_name}</p>
                      <p className="truncate text-[12px] text-[#80868B]">{s.description}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/projects/${id}/artifacts/new`)}
                      className="shrink-0 rounded-full border border-[#E8EAED] px-3 py-1.5 text-[12px] font-medium text-[#5F6368] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#F1F3F4]"
                    >
                      Start →
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8EAED] bg-white py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F3F4] text-2xl">💡</div>
              <p className="mt-3 text-[14px] font-medium text-[#1F1F1F]">No suggestions</p>
              <p className="mt-1 text-[13px] text-[#80868B]">Suggestions will appear based on your project brief</p>
            </div>
          )}
        </div>
      )}

      {/* Brief tab */}
      {activeTab === "brief" && (
        <div className="max-w-xl space-y-3">
          {/* Key-value fields */}
          <div className="rounded-xl border border-[#E8EAED] bg-white divide-y divide-[#F1F3F4]">
            {[
              { label: "Product",   value: project.product },
              { label: "Audience",  value: project.target_audience },
              { label: "Period",    value: project.campaign_period },
              { label: "Brand kit", value: project.brand_kit_id ? "Active" : null, green: true },
              { label: "Key message", value: project.key_message },
            ].filter((f) => f.value).map(({ label, value, green }) => (
              <div key={label} className="flex items-baseline gap-6 px-5 py-3.5">
                <span className="w-24 shrink-0 text-[12px] text-[#80868B]">{label}</span>
                <span className={`text-[14px] font-medium ${green ? "text-[#188038]" : "text-[#1F1F1F]"}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="rounded-xl border border-[#E8EAED] bg-white px-5 py-4">
            <p className="mb-3 text-[12px] font-medium text-[#80868B]">Stats</p>
            <div className="flex gap-8">
              {[
                { label: "Artifacts",   value: project.artifact_count },
                { label: "Suggestions", value: project.suggestion_count },
                ...(isTeam ? [{ label: "Members", value: project.member_count }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[24px] font-semibold text-[#1F1F1F]">{value}</p>
                  <p className="text-[12px] text-[#80868B]">{label}</p>
                </div>
              ))}
              <div>
                <span className="inline-block rounded-full bg-[#E6F4EA] px-2.5 py-0.5 text-[12px] font-medium text-[#188038]">{project.status}</span>
                <p className="mt-1 text-[12px] text-[#80868B]">Status</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members tab — team only */}
      {activeTab === "members" && isTeam && (
        <div className="max-w-xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] text-[#80868B]">{members.length} member{members.length !== 1 ? "s" : ""}</p>
            {isOwner && isCreator && (
              <button className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] px-3 py-1.5 text-[13px] font-medium text-[#D0103A] transition-colors hover:bg-[#FFF8F9]">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                Invite member
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {members.map((member) => {
              const initials = member.user_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-[#E8EAED] bg-white px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EAED] text-[12px] font-semibold text-[#3C4043]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#1F1F1F]">{member.user_name}</p>
                    <p className="text-[12px] text-[#80868B]">{member.user_role.replace("_", " ")}</p>
                  </div>
                  {member.role === "owner" && (
                    <span className={badge.amber}>Owner</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
