"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectPurposeBadge } from "@/components/projects/project-purpose-badge";
import { fetchProjectDetail, setProjectStatus, deleteProject, type ProjectDetail } from "@/lib/api/projects";
import { fetchSuggestions } from "@/lib/api/suggestions";
import { fetchProjectArtifacts, deleteArtifact } from "@/lib/api/artifacts";
import { fetchMembers, type ProjectMember } from "@/lib/api/members";
import type { ArtifactSuggestion } from "@/types/suggestion";
import type { Artifact } from "@/types/artifact";
import { isCreatorRole } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Avatar from "@mui/material/Avatar";
import Skeleton from "@mui/material/Skeleton";

// ─── Artifact navigation ──────────────────────────────────────────────────────

function artifactUrl(projectId: string, artifact: { id: string; type: string }): string {
  if (artifact.type === "poster") {
    return `/projects/${projectId}/artifacts/new-poster/brief?load=${artifact.id}`;
  }
  if (artifact.type === "video" || artifact.type === "reel") {
    return `/projects/${projectId}/artifacts/${artifact.id}/video/brief`;
  }
  return `/projects/${projectId}/artifacts/${artifact.id}`;
}

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { hex: string; pastel: string; label: string; icon: React.ReactNode; iconLg: React.ReactNode }> = {
  video: {
    hex: "#059669", pastel: "#E8F8F3", label: "Videos",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M5 4l15 8L5 20V4z"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="#059669"><path d="M5 4l15 8L5 20V4z"/></svg>,
  },
  reel: {
    hex: "#059669", pastel: "#E8F8F3", label: "Reels",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M5 4l15 8L5 20V4z"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="#059669"><path d="M5 4l15 8L5 20V4z"/></svg>,
  },
  poster: {
    hex: "#7C3AED", pastel: "#F2EDFF", label: "Posters",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="white" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#7C3AED" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>,
  },
  whatsapp_card: {
    hex: "#D0103A", pastel: "#FFF0F3", label: "WhatsApp Cards",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="#D0103A"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  story: {
    hex: "#D97706", pastel: "#FEF5E7", label: "Stories",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="7" y="2" width="10" height="20" rx="2"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><rect x="7" y="2" width="10" height="20" rx="2"/></svg>,
  },
  infographic: {
    hex: "#0891B2", pastel: "#E0F5FB", label: "Infographics",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  },
  slide_deck: {
    hex: "#475569", pastel: "#F0F2F5", label: "Slide Decks",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    iconLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  },
};

const STATUS_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  draft:    { label: "draft",    bg: "#F1F3F4", color: "#5F6368" },
  ready:    { label: "ready",   bg: "#E6F4EA", color: "#188038" },
  exported: { label: "exported", bg: "#E6F4EA", color: "#188038" },
};

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "name",   label: "Name (A–Z)" },
  { value: "oldest", label: "Oldest first" },
];

type TabId = "artifacts" | "suggestions" | "brief" | "members";

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({});
  const [showDelete, setShowDelete]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isActing, setIsActing]       = useState(false);
  const [artifactToDelete, setArtifactToDelete] = useState<Artifact | null>(null);
  const [isDeletingArtifact, setIsDeletingArtifact] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchProjectDetail(id),
      fetchSuggestions(id).catch(() => []),
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

  // ── Loading ──
  if (isLoading || !project || !user) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 3 }}>
        <Skeleton width={80} height={32} sx={{ borderRadius: 9999, mb: 2 }} />
        <Skeleton width={280} height={32} sx={{ borderRadius: 1, mb: 1 }} />
        <Skeleton width={120} height={16} sx={{ borderRadius: 1, mb: 3 }} />
        <Skeleton height={44} sx={{ borderRadius: 1, mb: 2 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={112} sx={{ borderRadius: "12px" }} />
          ))}
        </Box>
      </Box>
    );
  }

  const isTeam    = project.type === "team";
  const isOwner   = project.owner.id === user.id;
  const isCreator = isCreatorRole(user.role);
  const canManage = isOwner || isCreator;
  const selectedSuggestions = suggestions.filter((s) => s.selected);

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "brief",       label: "Brief" },
    { id: "artifacts",   label: "Artifacts",   count: artifacts.length },
    { id: "suggestions", label: "Suggestions", count: selectedSuggestions.length },
    ...(isTeam ? [{ id: "members" as TabId, label: "Members", count: members.length }] : []),
  ];

  const tabIndex = TABS.findIndex((t) => t.id === activeTab);

  const handleToggleStatus = async () => {
    setIsActing(true);
    try {
      const newStatus = project.status === "active" ? "archived" : "active";
      const updated = await setProjectStatus(project.id, newStatus);
      if (newStatus === "archived") router.push("/home");
      else { setProject(updated); setIsActing(false); }
    } catch { setIsActing(false); }
  };

  const handleDelete = async () => {
    setIsActing(true);
    try {
      await deleteProject(project.id);
      router.push("/home");
    } catch { setIsActing(false); }
  };

  const handleDeleteArtifact = async () => {
    if (!artifactToDelete) return;
    setIsDeletingArtifact(true);
    try {
      await deleteArtifact(artifactToDelete.id);
      setArtifacts((prev) => prev.filter((a) => a.id !== artifactToDelete.id));
      setArtifactToDelete(null);
    } finally {
      setIsDeletingArtifact(false);
    }
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 3 }}>

      {/* ── Header row 1: back + badges ── */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push("/home")}
          startIcon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8l4 4" />
            </svg>
          }
          sx={{
            borderColor: "#E8EAED",
            color: "#5F6368",
            fontSize: "13px",
            fontWeight: 500,
            px: 1.5,
            py: 0.5,
            "&:hover": { borderColor: "#DADCE0", bgcolor: "#F1F3F4", color: "#1F1F1F" },
          }}
        >
          Back
        </Button>

        <ProjectPurposeBadge purpose={project.purpose} />

        {isTeam && (
          <Chip
            label={`Team · ${project.member_count} members`}
            size="small"
            color="success"
            sx={{ height: 22, fontSize: "11px", fontWeight: 600 }}
          />
        )}

        {project.status === "archived" && (
          <Chip
            label="Archived"
            size="small"
            sx={{ height: 22, fontSize: "11px", fontWeight: 600, bgcolor: "#F1F3F4", color: "#5F6368" }}
          />
        )}
      </Box>

      {/* ── Header row 2: title + actions ── */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 3 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: "24px", fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2 }}>
            {project.name}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "13px", color: "#9E9E9E" }}>
            by {project.owner.name}
          </Typography>
        </Box>

        {canManage && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, mt: 0.5 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleToggleStatus}
              disabled={isActing}
              startIcon={
                project.status === "active"
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              }
              sx={{ borderColor: "#E8EAED", color: "#5F6368", fontSize: "13px", fontWeight: 500, "&:hover": { borderColor: "#DADCE0", bgcolor: "#F1F3F4", color: "#1F1F1F" } }}
            >
              {project.status === "active" ? "Archive" : "Restore"}
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => { setShowDelete(true); setDeleteConfirm(""); }}
              startIcon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              }
              sx={{
                borderColor: "#FADDE1",
                color: "#D0103A",
                fontSize: "13px",
                fontWeight: 500,
                "&:hover": { borderColor: "#D0103A", bgcolor: "#FFF0F3" },
              }}
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Tabs ── */}
      <Tabs
        value={tabIndex === -1 ? 0 : tabIndex}
        onChange={(_, i) => setActiveTab(TABS[i].id)}
        sx={{ mb: 3.5 }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.id}
            disableRipple
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.875 }}>
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <Box
                    component="span"
                    sx={{
                      bgcolor: "#F1F3F4",
                      color: "#5F6368",
                      borderRadius: 9999,
                      px: 0.875,
                      py: 0.125,
                      fontSize: "11px",
                      fontWeight: 600,
                      lineHeight: "16px",
                    }}
                  >
                    {t.count}
                  </Box>
                )}
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* ══════════════════════════════════════════════════
          BRIEF TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === "brief" && (
        <Box sx={{ maxWidth: 560 }}>
          {/* Key-value fields */}
          <Box sx={{ borderRadius: "14px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", overflow: "hidden", mb: 2 }}>
            {[
              { label: "Product",     value: project.product },
              { label: "Audience",    value: project.target_audience },
              { label: "Period",      value: project.campaign_period },
              { label: "Brand kit",   value: project.brand_kit_id ? "Active" : null, green: true },
              { label: "Key message", value: project.key_message },
            ].filter((f) => f.value).map(({ label, value, green }, i, arr) => (
              <Box
                key={label}
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  px: 2.5,
                  py: 1.75,
                  borderBottom: i < arr.length - 1 ? "1px solid #F5F5F5" : "none",
                }}
              >
                <Typography sx={{ width: 96, flexShrink: 0, fontSize: "12px", color: "#9E9E9E" }}>{label}</Typography>
                <Typography sx={{ fontSize: "14px", fontWeight: 500, color: green ? "#188038" : "#1F1F1F" }}>{value}</Typography>
              </Box>
            ))}
          </Box>

          {/* Stats */}
          <Box sx={{ borderRadius: "14px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", px: 2.5, py: 2.5 }}>
            <Typography sx={{ mb: 2, fontSize: "12px", fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Stats
            </Typography>
            <Box sx={{ display: "flex", gap: 5 }}>
              {[
                { label: "Artifacts",   value: project.artifact_count },
                { label: "Suggestions", value: project.suggestion_count },
                ...(isTeam ? [{ label: "Members", value: project.member_count }] : []),
              ].map(({ label, value }) => (
                <Box key={label}>
                  <Typography sx={{ fontSize: "26px", fontWeight: 700, color: "#1A1A1A", lineHeight: 1.1 }}>{value}</Typography>
                  <Typography sx={{ fontSize: "12px", color: "#9E9E9E", mt: 0.5 }}>{label}</Typography>
                </Box>
              ))}
              <Box>
                <Chip
                  label={project.status}
                  size="small"
                  color={project.status === "active" ? "success" : "default"}
                  sx={{ height: 24, fontSize: "12px", fontWeight: 600, mb: 0.5 }}
                />
                <Typography sx={{ fontSize: "12px", color: "#9E9E9E" }}>Status</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════
          ARTIFACTS TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === "artifacts" && (
        <Box>
          {artifacts.length === 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "20px", background: "linear-gradient(135deg,#FFF8FA 0%,#FAFCFF 100%)", border: "1.5px dashed #E8EAED", py: 12 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "16px", bgcolor: "#FCE8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", mb: 2 }}>🎨</Box>
              <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#1F1F1F" }}>No artifacts yet</Typography>
              <Typography sx={{ fontSize: "13px", color: "#9E9E9E", mt: 0.75, mb: 3 }}>Create your first artifact for this project</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push(`/projects/${project.id}/artifacts/new`)}
                startIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                sx={{ fontWeight: 600, fontSize: "13px", px: 3 }}
              >
                New artifact
              </Button>
            </Box>
          ) : (
            <>
              {/* Toolbar */}
              <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                <ToggleButtonGroup exclusive value={view} onChange={(_, v) => { if (v) setView(v); }} size="small"
                  sx={{ "& .MuiToggleButton-root": { px: 1.25, py: 0.625, border: "1px solid #E8EAED", color: "#9E9E9E", "&.Mui-selected": { bgcolor: "#1F1F1F", color: "#FFFFFF", borderColor: "#1F1F1F" }, "&:hover:not(.Mui-selected)": { bgcolor: "#F5F5F5" } } }}>
                  <ToggleButton value="grid" title="Grid view">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/>
                      <rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>
                    </svg>
                  </ToggleButton>
                  <ToggleButton value="list" title="List view">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/>
                    </svg>
                  </ToggleButton>
                </ToggleButtonGroup>

                <Box sx={{ display: "flex", alignItems: "center", borderRadius: 9999, border: "1px solid #E8EAED", bgcolor: "#FFFFFF", px: 1.75, height: 34, "&:hover": { bgcolor: "#F5F5F5" }, transition: "background 0.15s ease" }}>
                  <Select
                    variant="standard"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as "recent" | "name" | "oldest")}
                    disableUnderline
                    sx={{ fontSize: "13px", fontWeight: 500, color: "#3C4043", "& .MuiSelect-select": { p: 0, pr: "20px !important" }, "& .MuiSelect-icon": { right: 0, color: "#757575", fontSize: "18px" } }}
                  >
                    {SORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={() => router.push(`/projects/${project.id}/artifacts/new`)}
                  startIcon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                  sx={{ fontWeight: 600, fontSize: "13px", px: 2, height: 34 }}
                >
                  New artifact
                </Button>
              </Box>

              {/* Type groups */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {Object.entries(groupedArtifacts).map(([type, items]) => {
                  const meta = TYPE_META[type] ?? { hex: "#6B7280", pastel: "#F5F5F5", label: type, icon: <span>◻</span>, iconLg: <span>◻</span> };
                  const isCollapsed = collapsed[type];

                  return (
                    <Box key={type}>
                      {/* Section header — clean, no box */}
                      <Box
                        onClick={() => setCollapsed((c) => ({ ...c, [type]: !c[type] }))}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.25,
                          mb: 1.5,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "9px",
                            bgcolor: meta.hex,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {meta.icon}
                        </Box>
                        <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#1F1F1F" }}>{meta.label}</Typography>
                        <Box
                          component="span"
                          sx={{ borderRadius: 9999, bgcolor: meta.pastel, color: meta.hex, px: 1, py: 0.25, fontSize: "11px", fontWeight: 700 }}
                        >
                          {items.length}
                        </Box>
                        <Box sx={{ ml: "auto", color: "#BDBDBD", display: "flex", alignItems: "center", transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s ease" }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6l4 4 4-4"/>
                          </svg>
                        </Box>
                      </Box>

                      {/* Group content */}
                      {!isCollapsed && (
                        view === "grid" ? (
                          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5, "@media (min-width:600px)": { gridTemplateColumns: "repeat(3, 1fr)" }, "@media (min-width:900px)": { gridTemplateColumns: "repeat(5, 1fr)" } }}>
                            {items.map((artifact) => {
                              const sc = STATUS_CHIP[artifact.status] ?? STATUS_CHIP.draft;
                              return (
                                <Box
                                  key={artifact.id}
                                  onClick={() => router.push(artifactUrl(id, artifact))}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => { if (e.key === "Enter") router.push(artifactUrl(id, artifact)); }}
                                  sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    borderRadius: "14px",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    transition: "all 0.18s ease",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                                    "& .delete-btn": { opacity: 0 },
                                    "&:hover": { transform: "translateY(-2px)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", "& .delete-btn": { opacity: 1 } },
                                  }}
                                >
                                  {/* Card thumbnail area */}
                                  <Box sx={{
                                    bgcolor: meta.pastel,
                                    height: 88,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    position: "relative",
                                  }}>
                                    <Box sx={{ opacity: 0.6 }}>{meta.iconLg}</Box>
                                    <Box component="span" sx={{ position: "absolute", top: 8, right: 8, borderRadius: 9999, bgcolor: sc.bg, color: sc.color, px: 1, py: 0.25, fontSize: "10px", fontWeight: 700 }}>
                                      {sc.label}
                                    </Box>
                                    {canManage && (
                                      <Box
                                        className="delete-btn"
                                        component="button"
                                        aria-label={`Delete ${artifact.name}`}
                                        onClick={(e) => { e.stopPropagation(); setArtifactToDelete(artifact); }}
                                        sx={{
                                          position: "absolute", top: 6, left: 6,
                                          width: 24, height: 24, borderRadius: "50%",
                                          border: "none", bgcolor: "rgba(255,255,255,0.92)", color: "#5F6368",
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                          cursor: "pointer", p: 0, transition: "opacity 0.15s ease, color 0.15s ease, background 0.15s ease",
                                          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                          "&:hover": { color: "#D0103A", bgcolor: "#FFFFFF" },
                                        }}
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="3 6 5 6 21 6"/>
                                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                          <path d="M10 11v6M14 11v6"/>
                                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                        </svg>
                                      </Box>
                                    )}
                                  </Box>
                                  {/* Card info area */}
                                  <Box sx={{ bgcolor: "#FFFFFF", px: 1.5, py: 1.25 }}>
                                    <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#1F1F1F", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 0.5 }}>
                                      {artifact.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: "11px", color: "#BDBDBD" }}>
                                      v{artifact.version} · {new Date(artifact.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, {new Date(artifact.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                                    </Typography>
                                  </Box>
                                </Box>
                              );
                            })}

                            {/* New artifact card */}
                            <Box
                              onClick={() => router.push(`/projects/${project.id}/artifacts/new`)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === "Enter") router.push(`/projects/${project.id}/artifacts/new`); }}
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.75,
                                borderRadius: "14px",
                                border: "1.5px dashed #E0E0E0",
                                minHeight: 130,
                                cursor: "pointer",
                                color: "#C0C0C0",
                                bgcolor: "#FAFAFA",
                                transition: "all 0.18s ease",
                                "&:hover": { borderColor: "#D0103A", bgcolor: "#FFF5F7", color: "#D0103A" },
                              }}
                            >
                              <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "currentColor", opacity: 0.12, position: "absolute" }} />
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                              </svg>
                              <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "inherit" }}>New</Typography>
                            </Box>
                          </Box>
                        ) : (
                          /* List view */
                          <Box sx={{ borderRadius: "14px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", overflow: "hidden" }}>
                            {items.map((artifact, idx) => {
                              const sc = STATUS_CHIP[artifact.status] ?? STATUS_CHIP.draft;
                              return (
                                <Box
                                  key={artifact.id}
                                  onClick={() => router.push(artifactUrl(id, artifact))}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => { if (e.key === "Enter") router.push(artifactUrl(id, artifact)); }}
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                    px: 2,
                                    py: 1.5,
                                    cursor: "pointer",
                                    borderBottom: idx < items.length - 1 ? "1px solid #F5F5F5" : "none",
                                    transition: "background 0.15s ease",
                                    "& .delete-btn": { opacity: 0 },
                                    "&:hover": { bgcolor: "#FAFAFA", "& .delete-btn": { opacity: 1 } },
                                  }}
                                >
                                  <Box sx={{ width: 36, height: 36, borderRadius: "9px", bgcolor: meta.pastel, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Box sx={{ opacity: 0.8 }}>{meta.iconLg && <svg width="16" height="16" viewBox="0 0 24 24" fill={meta.hex}>{type === "video" || type === "reel" ? <path d="M5 4l15 8L5 20V4z"/> : type === "whatsapp_card" ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> : null}</svg>}</Box>
                                  </Box>
                                  <Box sx={{ flex: 1, overflow: "hidden" }}>
                                    <Typography sx={{ fontSize: "13px", fontWeight: 500, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {artifact.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: "11px", color: "#BDBDBD" }}>
                                      {new Date(artifact.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, {new Date(artifact.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                                    </Typography>
                                  </Box>
                                  <Box component="span" sx={{ borderRadius: 9999, bgcolor: sc.bg, color: sc.color, px: 1.25, py: 0.375, fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>
                                    {sc.label}
                                  </Box>
                                  <Typography sx={{ fontSize: "11px", color: "#BDBDBD", flexShrink: 0, minWidth: 24 }}>v{artifact.version}</Typography>
                                  {canManage && (
                                    <Box
                                      className="delete-btn"
                                      component="button"
                                      aria-label={`Delete ${artifact.name}`}
                                      onClick={(e) => { e.stopPropagation(); setArtifactToDelete(artifact); }}
                                      sx={{
                                        width: 28, height: 28, borderRadius: "50%",
                                        border: "none", bgcolor: "transparent", color: "#9E9E9E",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", p: 0, flexShrink: 0,
                                        transition: "opacity 0.15s ease, color 0.15s ease, background 0.15s ease",
                                        "&:hover": { color: "#D0103A", bgcolor: "#FFF1F4" },
                                      }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </Box>
                                  )}
                                  <Box sx={{ color: "#D0D0D0", flexShrink: 0, display: "flex" }}>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M6 4l4 4-4 4"/>
                                    </svg>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        )
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Box>
      )}

      {/* ══════════════════════════════════════════════════
          SUGGESTIONS TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === "suggestions" && (
        <Box>
          {selectedSuggestions.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {selectedSuggestions.map((s) => {
                const meta = TYPE_META[s.artifact_type] ?? { hex: "#7C3AED", label: s.artifact_type, icon: <span>◻</span> };
                return (
                  <Box
                    key={s.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      borderRadius: "14px",
                      border: "1px solid #F0F0F0",
                      bgcolor: "#FFFFFF",
                      px: 2,
                      py: 1.5,
                      transition: "all 0.15s ease",
                      "& .start-btn": { opacity: 0 },
                      "&:hover": { borderColor: "#E0E0E0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", "& .start-btn": { opacity: 1 } },
                    }}
                  >
                    <Box sx={{ width: 32, height: 32, borderRadius: "8px", bgcolor: meta.hex, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {meta.icon}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.artifact_name}
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: "#9E9E9E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.description}
                      </Typography>
                    </Box>
                    <Button
                      className="start-btn"
                      variant="outlined"
                      size="small"
                      onClick={() => router.push(`/projects/${id}/artifacts/new`)}
                      sx={{ fontSize: "12px", fontWeight: 500, borderColor: "#E8EAED", color: "#5F6368", flexShrink: 0, transition: "opacity 0.15s ease", "&:hover": { borderColor: "#DADCE0", bgcolor: "#F1F3F4" } }}
                    >
                      Start →
                    </Button>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "16px", border: "1.5px dashed #E8EAED", py: 10, gap: 1 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: "14px", bgcolor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>💡</Box>
              <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#1F1F1F" }}>No suggestions</Typography>
              <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>Suggestions will appear based on your project brief</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ══════════════════════════════════════════════════
          MEMBERS TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === "members" && isTeam && (
        <Box sx={{ maxWidth: 560 }}>
          <Box sx={{ mb: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </Typography>
            {isOwner && isCreator && (
              <Button
                variant="outlined"
                size="small"
                sx={{ fontSize: "13px", fontWeight: 500, color: "#D0103A", borderColor: "#FADDE1", "&:hover": { borderColor: "#D0103A", bgcolor: "#FFF0F3" } }}
                startIcon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>}
              >
                Invite member
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {members.map((member) => {
              const initials = member.user_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Box
                  key={member.id}
                  sx={{ display: "flex", alignItems: "center", gap: 2, borderRadius: "14px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", px: 2, py: 1.5 }}
                >
                  <Avatar sx={{ width: 36, height: 36, bgcolor: "#F1F3F4", color: "#3C4043", fontSize: "12px", fontWeight: 600 }}>
                    {initials}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: "14px", fontWeight: 500, color: "#1F1F1F" }}>{member.user_name}</Typography>
                    <Typography sx={{ fontSize: "12px", color: "#9E9E9E" }}>{member.user_role.replace("_", " ")}</Typography>
                  </Box>
                  {member.role === "owner" && (
                    <Chip label="Owner" size="small" color="warning" sx={{ height: 20, fontSize: "10px", fontWeight: 600 }} />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: "#FFF0F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D0103A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </Box>
            <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A" }}>
              Delete &ldquo;{project.name}&rdquo;?
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: "0 !important" }}>
          <Typography sx={{ fontSize: "13px", color: "#5F6368", lineHeight: 1.6, mb: 2.5 }}>
            This will permanently delete the project and all its artifacts, suggestions, and members. This action cannot be undone.
          </Typography>
          <Typography sx={{ fontSize: "12px", fontWeight: 500, color: "#3C4043", mb: 1 }}>
            Type <Box component="span" sx={{ fontWeight: 700, color: "#1F1F1F" }}>{project.name}</Box> to confirm
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={project.name}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setShowDelete(false)}
            sx={{ borderColor: "#E8EAED", color: "#3C4043", fontWeight: 500, "&:hover": { bgcolor: "#F1F3F4" } }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleDelete}
            disabled={deleteConfirm !== project.name || isActing}
            sx={{ fontWeight: 600 }}
          >
            {isActing ? "Deleting…" : "Delete project"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Artifact delete confirmation dialog ── */}
      <Dialog open={artifactToDelete !== null} onClose={() => !isDeletingArtifact && setArtifactToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: "#FFF0F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D0103A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </Box>
            <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A" }}>
              Delete artifact?
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: "0 !important" }}>
          <Typography sx={{ fontSize: "13px", color: "#5F6368", lineHeight: 1.6 }}>
            &ldquo;{artifactToDelete?.name}&rdquo; will be removed from this project. This action can&rsquo;t be undone from the UI.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setArtifactToDelete(null)}
            disabled={isDeletingArtifact}
            sx={{ borderColor: "#E8EAED", color: "#3C4043", fontWeight: 500, "&:hover": { bgcolor: "#F1F3F4" } }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleDeleteArtifact}
            disabled={isDeletingArtifact}
            sx={{ fontWeight: 600 }}
          >
            {isDeletingArtifact ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
