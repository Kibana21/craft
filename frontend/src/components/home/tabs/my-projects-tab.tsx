"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard, NewProjectCard } from "@/components/cards/project-card";
import { fetchProjects } from "@/lib/api/projects";
import type { Project } from "@/types/project";

export function MyProjectsTab() {
  const router = useRouter();
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
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl bg-[#F7F7F7]"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#222222]">My Projects</h2>
          <p className="mt-0.5 text-sm text-[#717171]">
            Your personal drafts and solo work
          </p>
        </div>
        <button
          onClick={() => router.push("/projects/new")}
          className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]"
        >
          + New project
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onClick={() => router.push(`/projects/${project.id}`)} />
        ))}
        <NewProjectCard onClick={() => router.push("/projects/new")} />
      </div>

      {projects.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
            📁
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#222222]">
            No projects yet
          </h3>
          <p className="mt-1 text-sm text-[#717171]">
            Create your first campaign to get started
          </p>
        </div>
      )}
    </div>
  );
}
