"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard, NewProjectCard } from "@/components/cards/project-card";
import { fetchProjects } from "@/lib/api/projects";
import { layout, text } from "@/lib/ui";
import type { Project } from "@/types/project";

type View = "grid" | "list";
type Sort = "recent" | "name" | "oldest";

const SORT_LABELS: Record<Sort, string> = {
  recent:  "Most recent",
  name:    "Name (A–Z)",
  oldest:  "Oldest first",
};

function sortProjects(projects: Project[], sort: Sort): Project[] {
  return [...projects].sort((a, b) => {
    if (sort === "name")   return a.name.localeCompare(b.name);
    if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function MyProjectsTab() {
  const router = useRouter();
  const [projects, setProjects]     = useState<Project[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [view, setView]             = useState<View>("grid");
  const [sort, setSort]             = useState<Sort>("recent");
  const [search, setSearch]         = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen]     = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetchProjects("personal", statusFilter)
      .then((res) => setProjects(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    return sortProjects(base, sort);
  }, [projects, search, sort]);

  if (isLoading) {
    return (
      <div>
        <div className="mb-5 h-4 w-24 animate-pulse rounded bg-[#F1F3F4]" />
        <div className={layout.grid5}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#E8EAED] p-5">
              <div className="mb-4 h-12 w-12 animate-pulse rounded-xl bg-[#F1F3F4]" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-[#F1F3F4]" />
              <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-[#F8F9FA]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className={text.h2}>{statusFilter === "archived" ? "Archived projects" : "Recent projects"}</h2>
          <div className="flex items-center rounded-full border border-[#E8EAED] bg-white p-0.5">
            <button
              onClick={() => { setStatusFilter("active"); setSearch(""); }}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${statusFilter === "active" ? "bg-[#1F1F1F] text-white" : "text-[#80868B] hover:text-[#3C4043]"}`}
            >Active</button>
            <button
              onClick={() => { setStatusFilter("archived"); setSearch(""); }}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${statusFilter === "archived" ? "bg-[#1F1F1F] text-white" : "text-[#80868B] hover:text-[#3C4043]"}`}
            >Archived</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">

          {/* Search */}
          <div className="flex items-center">
            {searchOpen ? (
              <div className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] bg-white px-3 py-1.5 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#80868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => { if (!search) setSearchOpen(false); }}
                  placeholder="Search projects…"
                  className="w-40 bg-transparent text-[13px] text-[#1F1F1F] placeholder-[#BDC1C6] outline-none"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setSearchOpen(false); }} className="text-[#80868B] hover:text-[#5F6368]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8EAED] bg-white text-[#5F6368] transition-colors hover:bg-[#F1F3F4]"
                aria-label="Search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-full border border-[#E8EAED] bg-white p-1">
            <button
              onClick={() => setView("grid")}
              title="Grid view"
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${view === "grid" ? "bg-[#E8EAED] text-[#1F1F1F]" : "text-[#80868B] hover:text-[#3C4043]"}`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              title="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${view === "list" ? "bg-[#E8EAED] text-[#1F1F1F]" : "text-[#80868B] hover:text-[#3C4043]"}`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="4" x2="13" y2="4" />
                <line x1="3" y1="8" x2="13" y2="8" />
                <line x1="3" y1="12" x2="13" y2="12" />
              </svg>
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full border border-[#E8EAED] bg-white px-4 py-1.5 text-[13px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]"
            >
              {SORT_LABELS[sort]}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#E8EAED] bg-white py-1 shadow-[0_4px_16px_rgba(32,33,36,0.12)]">
                  {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSort(s); setSortOpen(false); }}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[#F1F3F4] ${sort === s ? "font-medium text-[#1F1F1F]" : "text-[#5F6368]"}`}
                    >
                      {sort === s && (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#D0103A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 8 6 12 14 4" />
                        </svg>
                      )}
                      {sort !== s && <span className="w-[13px]" />}
                      {SORT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Grid view */}
      {view === "grid" && (
        <div className={layout.grid5}>
          {statusFilter === "active" && <NewProjectCard onClick={() => router.push("/projects/new")} />}
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
          ))}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {statusFilter === "active" && (
            <button
              onClick={() => router.push("/projects/new")}
              className="flex w-full items-center gap-4 rounded-xl border border-dashed border-[#DADCE0] bg-white px-4 py-3.5 text-left transition-all hover:border-[#D0103A] hover:bg-[#FFF8F9]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F3F4] text-[#80868B]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-[#5F6368]">Create new project</p>
            </button>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="flex w-full items-center gap-4 rounded-xl border border-[#E8EAED] bg-white px-4 py-3.5 text-left transition-all hover:border-[#DADCE0] hover:shadow-[0_1px_4px_rgba(32,33,36,0.08)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: getThemeBg(p.name) }}>
                {getThemeEmoji(p.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#1F1F1F]">{p.name}</p>
                <p className="text-[12px] text-[#80868B]">{p.artifact_count} artifact{p.artifact_count !== 1 ? "s" : ""}</p>
              </div>
              {statusFilter === "archived" && (
                <span className="shrink-0 rounded-full bg-[#F1F3F4] px-2 py-0.5 text-[11px] font-medium text-[#80868B]">Archived</span>
              )}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#DADCE0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="mt-20 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F3F4]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#80868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#1F1F1F]">
            {search ? "No projects match your search" : statusFilter === "archived" ? "No archived projects" : "No projects yet"}
          </p>
          <p className="text-[13px] text-[#80868B]">
            {search ? "Try a different keyword" : statusFilter === "archived" ? "Archived projects will appear here" : "Create your first campaign to get started"}
          </p>
        </div>
      )}
    </div>
  );
}

// Mirror the theme logic from ProjectCard so list view icons match
const PROJECT_THEMES = [
  { bg: "#E8F0FE", emoji: "📋" },
  { bg: "#FCE8E6", emoji: "🎯" },
  { bg: "#E6F4EA", emoji: "📂" },
  { bg: "#FEF7E0", emoji: "⚡" },
  { bg: "#F3E8FD", emoji: "✨" },
  { bg: "#E8F5E9", emoji: "🌿" },
  { bg: "#FDE7EF", emoji: "💡" },
  { bg: "#E8EAF6", emoji: "🔷" },
];

function getIdx(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % PROJECT_THEMES.length;
}
function getThemeBg(name: string)    { return PROJECT_THEMES[getIdx(name)].bg; }
function getThemeEmoji(name: string) { return PROJECT_THEMES[getIdx(name)].emoji; }
