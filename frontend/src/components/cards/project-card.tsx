import type { Project } from "@/types/project";

// Generate a consistent color from a string
function getProjectColor(name: string): string {
  const colors = [
    "#D0103A", "#534AB7", "#1B9D74", "#1C3044",
    "#BA7517", "#8B5CF6", "#0891B2", "#DC2626",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const color = getProjectColor(project.name);
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
      className={`w-full overflow-hidden rounded-lg border text-left transition-colors hover:border-[#C8C2B6] ${
        isTeam ? "border-[#9FE1CB]" : "border-[#E2DDD4]"
      }`}
    >
      {/* Colored header */}
      <div
        className="relative flex h-10 items-center justify-center text-xs font-bold text-white/70"
        style={{ backgroundColor: color }}
      >
        {abbreviation}
        {isTeam && (
          <span className="absolute right-1.5 top-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[7px] font-bold text-white">
            {project.member_count} members
          </span>
        )}
      </div>

      {/* Body */}
      <div className="bg-white px-3 py-2">
        <p className="truncate text-[11px] font-semibold text-[#1A1A18]">
          {project.name}
        </p>
        <p className="mt-0.5 text-[9px] text-[#9C9A92]">
          {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
          {isTeam && ` · by ${project.owner.name}`}
        </p>
      </div>
    </button>
  );
}

export function NewProjectCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-[74px] flex-col items-center justify-center gap-0.5 rounded-lg border-[1.5px] border-dashed border-[#C8C2B6] transition-colors hover:border-[#D0103A] hover:bg-[#FFF0F3]"
    >
      <span className="text-lg text-[#9C9A92] group-hover:text-[#D0103A]">+</span>
      <span className="text-[9px] text-[#9C9A92]">New project</span>
    </button>
  );
}
