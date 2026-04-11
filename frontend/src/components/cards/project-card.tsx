import type { Project } from "@/types/project";

const PROJECT_THEMES = [
  { bg: "#E8F0FE", color: "#1967D2", emoji: "📋" },
  { bg: "#FCE8E6", color: "#C5221F", emoji: "🎯" },
  { bg: "#E6F4EA", color: "#188038", emoji: "📂" },
  { bg: "#FEF7E0", color: "#E37400", emoji: "⚡" },
  { bg: "#F3E8FD", color: "#8430CE", emoji: "✨" },
  { bg: "#E8F5E9", color: "#1B7E3E", emoji: "🌿" },
  { bg: "#FDE7EF", color: "#C2185B", emoji: "💡" },
  { bg: "#E8EAF6", color: "#3949AB", emoji: "🔷" },
];

function getTheme(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PROJECT_THEMES[Math.abs(hash) % PROJECT_THEMES.length];
}

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const theme = getTheme(project.name);
  const isTeam = project.type === "team";

  return (
    <button
      onClick={onClick}
      className="group relative w-full rounded-2xl border border-[#E8EAED] bg-white p-5 text-left transition-all duration-150 hover:border-[#DADCE0] hover:shadow-[0_1px_6px_rgba(32,33,36,0.1)]"
    >
      {/* Three-dot menu placeholder */}
      <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[#80868B] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#F1F3F4]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="8" cy="13" r="1.2" />
        </svg>
      </div>

      {/* Icon */}
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl"
        style={{ backgroundColor: theme.bg }}
      >
        {theme.emoji}
      </div>

      {/* Title */}
      <p className="line-clamp-2 text-[14px] font-medium leading-snug text-[#1F1F1F]">
        {project.name}
      </p>

      {/* Meta */}
      <p className="mt-2 text-[12px] text-[#80868B]">
        {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
        {isTeam && project.member_count ? ` · ${project.member_count} members` : ""}
      </p>
    </button>
  );
}

export function NewProjectCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#DADCE0] bg-white p-5 transition-all duration-150 hover:border-[#D0103A] hover:bg-[#FFF8F9]"
      style={{ minHeight: 148 }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F3F4] text-[#80868B] transition-colors group-hover:bg-[#FCE8E6] group-hover:text-[#C5221F]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span className="text-[13px] font-medium text-[#5F6368] group-hover:text-[#C5221F]">
        Create new project
      </span>
    </button>
  );
}
