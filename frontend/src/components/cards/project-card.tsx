import type { Project } from "@/types/project";
import { card } from "@/lib/ui";

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

function getTheme(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PROJECT_THEMES[Math.abs(hash) % PROJECT_THEMES.length];
}

export function ProjectCard({ project, onClick }: { project: Project; onClick?: () => void }) {
  const theme = getTheme(project.name);
  const isTeam = project.type === "team";

  return (
    <button onClick={onClick} className={`group relative w-full text-left ${card.base} ${card.padding}`}>
      {/* Three-dot menu */}
      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[#80868B] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#F1F3F4]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
        </svg>
      </div>

      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: theme.bg }}>
        {theme.emoji}
      </div>

      <p className="line-clamp-2 text-[14px] font-medium leading-snug text-[#1F1F1F]">{project.name}</p>
      <p className="mt-2 text-[12px] text-[#80868B]">
        {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
        {isTeam && project.member_count ? ` · ${project.member_count} members` : ""}
      </p>
    </button>
  );
}

export function NewProjectCard({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`group ${card.new} ${card.padding}`} style={{ minHeight: 148 }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F3F4] text-[#80868B] transition-colors group-hover:bg-[#FCE8E6] group-hover:text-[#C5221F]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span className="text-[13px] font-medium text-[#5F6368] group-hover:text-[#C5221F]">Create new project</span>
    </button>
  );
}
