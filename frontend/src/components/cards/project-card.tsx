import type { Project } from "@/types/project";

const PROJECT_COLORS = [
  "from-red-600 to-red-500",
  "from-violet-600 to-violet-500",
  "from-emerald-600 to-emerald-500",
  "from-slate-700 to-slate-600",
  "from-amber-600 to-amber-500",
  "from-fuchsia-600 to-fuchsia-500",
  "from-cyan-600 to-cyan-500",
  "from-rose-600 to-rose-500",
];

function getProjectGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const gradient = getProjectGradient(project.name);
  const isTeam = project.type === "team";
  const abbreviation = project.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`group w-full overflow-hidden rounded-xl border border-[#EBEBEB] bg-white text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]`}
    >
      {/* Colored header */}
      <div
        className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${gradient}`}
      >
        <span className="text-3xl font-bold text-white/60">{abbreviation}</span>
        {isTeam && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {project.member_count} members
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <p className="truncate text-base font-semibold text-[#222222]">
          {project.name}
        </p>
        <p className="mt-1 text-sm text-[#717171]">
          {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
          {isTeam && (
            <span className="text-[#B0B0B0]"> · by {project.owner.name}</span>
          )}
        </p>
      </div>
    </button>
  );
}

export function NewProjectCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#DDDDDD] transition-all duration-200 hover:border-[#D0103A] hover:bg-[#FFF0F3]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F7F7] text-xl text-[#717171]">
        +
      </span>
      <span className="text-sm font-medium text-[#717171]">New project</span>
    </button>
  );
}
