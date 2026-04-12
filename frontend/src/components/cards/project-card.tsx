import type { Project } from "@/types/project";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

// Soft pastel themes — light, airy, pleasant (no dark gradients)
const PROJECT_THEMES = [
  { bg: "#ECEDF8", emoji: "📋" },  // soft lavender
  { bg: "#FAE8EC", emoji: "🎯" },  // soft rose
  { bg: "#E5F3EC", emoji: "📂" },  // soft mint
  { bg: "#FDF4E0", emoji: "⚡" },  // soft amber cream
  { bg: "#EEE8F8", emoji: "✨" },  // soft lilac
  { bg: "#E4EFF8", emoji: "🌿" },  // soft sky blue
  { bg: "#FAE8F4", emoji: "💡" },  // soft blush
  { bg: "#E2F2F0", emoji: "🔷" },  // soft seafoam
];

function getIdx(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % PROJECT_THEMES.length;
}

export function getProjectTheme(name: string) {
  return PROJECT_THEMES[getIdx(name)];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectCard({ project, onClick }: { project: Project; onClick?: () => void }) {
  const theme = getProjectTheme(project.name);

  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minHeight: 180,
        borderRadius: "16px",
        bgcolor: theme.bg,
        border: "none",
        cursor: "pointer",
        p: 2,
        textAlign: "left",
        position: "relative",
        transition: "all 0.18s ease",
        "& .card-menu": { opacity: 0 },
        "&:hover": {
          filter: "brightness(0.96)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          "& .card-menu": { opacity: 1 },
        },
      }}
    >
      {/* Three-dot menu */}
      <Box
        className="card-menu"
        sx={{ position: "absolute", top: 8, right: 8, transition: "opacity 0.15s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          size="small"
          sx={{
            width: 28,
            height: 28,
            color: "rgba(0,0,0,0.35)",
            "&:hover": { bgcolor: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.6)" },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </IconButton>
      </Box>

      {/* Emoji — top area */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "flex-start", pt: 0.5 }}>
        <Box component="span" sx={{ fontSize: "36px", lineHeight: 1, userSelect: "none" }}>
          {theme.emoji}
        </Box>
      </Box>

      {/* Text — bottom area */}
      <Box sx={{ mt: "auto" }}>
        <Typography
          sx={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#1A1A1A",
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            mb: 0.5,
          }}
        >
          {project.name}
        </Typography>
        <Typography sx={{ fontSize: "12px", color: "rgba(0,0,0,0.45)", lineHeight: 1.4 }}>
          {formatDate(project.created_at)} · {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
          {project.type === "team" && project.member_count ? ` · ${project.member_count} members` : ""}
        </Typography>
      </Box>
    </Box>
  );
}

export function NewProjectCard({ onClick }: { onClick?: () => void }) {
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minHeight: 180,
        borderRadius: "16px",
        bgcolor: "#FFFFFF",
        border: "1.5px solid #E8E8E8",
        cursor: "pointer",
        p: 2,
        textAlign: "left",
        position: "relative",
        transition: "all 0.18s ease",
        "&:hover": {
          borderColor: "#D0103A",
          "& .plus-circle": { bgcolor: "rgba(208,16,58,0.08)", borderColor: "#D0103A", color: "#D0103A" },
          "& .create-label": { color: "#D0103A" },
        },
      }}
    >
      {/* Plus circle — centered in top area */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", pb: 1 }}>
        <Box
          className="plus-circle"
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            bgcolor: "#F0F0F8",
            border: "1.5px solid transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8888AA",
            transition: "all 0.18s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Box>
      </Box>

      {/* Label */}
      <Box>
        <Typography
          className="create-label"
          sx={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#3C3C3C",
            transition: "color 0.18s ease",
          }}
        >
          Create new project
        </Typography>
      </Box>
    </Box>
  );
}
