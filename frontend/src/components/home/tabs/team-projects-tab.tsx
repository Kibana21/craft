"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectCard, NewProjectCard } from "@/components/cards/project-card";
import { fetchProjects } from "@/lib/api/projects";
import { isCreatorRole } from "@/lib/auth";
import type { Project } from "@/types/project";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputBase from "@mui/material/InputBase";

type Sort = "recent" | "name" | "oldest";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "recent",  label: "Most recent" },
  { value: "name",    label: "Name (A–Z)" },
  { value: "oldest",  label: "Oldest first" },
];

function sortProjects(projects: Project[], sort: Sort): Project[] {
  return [...projects].sort((a, b) => {
    if (sort === "name")   return a.name.localeCompare(b.name);
    if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 1.5,
  "@media (min-width:600px)":  { gridTemplateColumns: "repeat(3, 1fr)" },
  "@media (min-width:900px)":  { gridTemplateColumns: "repeat(4, 1fr)" },
  "@media (min-width:1200px)": { gridTemplateColumns: "repeat(5, 1fr)" },
};

export function TeamProjectsTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [sort, setSort] = useState<Sort>("recent");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const isCreator = user ? isCreatorRole(user.role) : false;

  useEffect(() => {
    setIsLoading(true);
    fetchProjects("team", statusFilter)
      .then((res) => setProjects(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    return sortProjects(base, sort);
  }, [projects, search, sort]);

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, gap: 2, flexWrap: "wrap" }}>

        {/* Status filters */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {(["active", "archived"] as const).map((f) => (
            <Box
              key={f}
              component="button"
              onClick={() => { setStatusFilter(f); setSearch(""); }}
              sx={{
                borderRadius: 9999,
                px: 2,
                py: 0.625,
                fontSize: "13px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                bgcolor: statusFilter === f ? "#1F1F1F" : "transparent",
                color: statusFilter === f ? "#FFFFFF" : "#6B6B6B",
                "&:hover": statusFilter !== f ? { bgcolor: "#F1F3F4", color: "#1F1F1F" } : {},
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Box>
          ))}
        </Box>

        {/* Right controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

          {/* Search */}
          {searchOpen ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, borderRadius: 9999, border: "1px solid #E0E0E0", bgcolor: "#FFFFFF", px: 1.5, py: 0.75, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <InputBase
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => { if (!search) setSearchOpen(false); }}
                placeholder="Search projects…"
                sx={{ fontSize: "13px", color: "#1F1F1F", width: 160, "& input::placeholder": { color: "#BDBDBD" } }}
              />
              {search && (
                <IconButton size="small" onClick={() => { setSearch(""); setSearchOpen(false); }} sx={{ p: 0.25, color: "#9E9E9E", "&:hover": { bgcolor: "transparent", color: "#616161" } }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </IconButton>
              )}
            </Box>
          ) : (
            <IconButton onClick={() => setSearchOpen(true)} aria-label="Search" size="small" sx={{ color: "#757575", "&:hover": { bgcolor: "#F5F5F5" } }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </IconButton>
          )}

          {/* Sort */}
          <Box sx={{ display: "flex", alignItems: "center", borderRadius: 9999, border: "1px solid #E8EAED", bgcolor: "#FFFFFF", px: 1.75, height: 34, "&:hover": { bgcolor: "#F5F5F5" }, transition: "background 0.15s ease" }}>
            <Select
              variant="standard"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              disableUnderline
              sx={{ fontSize: "13px", fontWeight: 500, color: "#3C4043", "& .MuiSelect-select": { p: 0, pr: "20px !important" }, "& .MuiSelect-icon": { right: 0, color: "#757575", fontSize: "18px" } }}
            >
              {SORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </Box>

          {isCreator && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => router.push("/projects/new?type=team")}
              startIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
              sx={{ fontWeight: 600, fontSize: "13px", px: 2, height: 34, flexShrink: 0 }}
            >
              Create new
            </Button>
          )}
        </Box>
      </Box>

      {/* Loading */}
      {isLoading && (
        <Box sx={GRID}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: "16px" }} />
          ))}
        </Box>
      )}

      {/* Grid */}
      {!isLoading && (
        <>
          {filtered.length === 0 && statusFilter === "archived" ? (
            <Box sx={{ mt: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>👥</Box>
              <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#1F1F1F" }}>No archived team projects</Typography>
              <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>Archived team projects will appear here</Typography>
            </Box>
          ) : filtered.length === 0 && search ? (
            <Box sx={{ mt: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#1F1F1F" }}>No projects match your search</Typography>
              <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>Try a different keyword</Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ mt: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>👥</Box>
              <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#1F1F1F" }}>No team projects</Typography>
              <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>
                {isCreator ? "Create one and invite members to collaborate" : "Your leader will add you to a project soon"}
              </Typography>
            </Box>
          ) : (
            <Box sx={GRID}>
              {isCreator && statusFilter === "active" && (
                <NewProjectCard onClick={() => router.push("/projects/new?type=team")} />
              )}
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
              ))}
            </Box>
          )}

          {!isCreator && filtered.length > 0 && (
            <Typography sx={{ mt: 3, fontSize: "12px", color: "#9E9E9E" }}>
              You can create artifacts inside these projects. Your leader can see everything you make here.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
