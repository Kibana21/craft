"use client";

import { useEffect, useState } from "react";
import { ProjectCard, NewProjectCard } from "@/components/cards/project-card";
import { fetchProjects } from "@/lib/api/projects";
import type { Project } from "@/types/project";

export function MyProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects("personal")
      .then((res) => setProjects(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-[74px] animate-pulse rounded-lg bg-[#E2DDD4]"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-[#1A1A18]">My Projects</h3>
        <button className="text-[10px] text-[#D0103A]">+ New project</button>
      </div>
      <p className="mb-3 text-[10px] text-[#9C9A92]">
        Your personal drafts and solo work
      </p>
      <div className="grid grid-cols-2 gap-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <NewProjectCard />
      </div>
      {projects.length === 0 && (
        <div className="mt-4 text-center">
          <p className="text-2xl">📁</p>
          <p className="mt-2 text-[11px] text-[#9C9A92]">
            No projects yet — create your first campaign
          </p>
        </div>
      )}
    </div>
  );
}
