"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectCard, NewProjectCard } from "@/components/cards/project-card";
import { fetchProjects } from "@/lib/api/projects";
import { isCreatorRole } from "@/lib/auth";
import type { Project } from "@/types/project";

export function TeamProjectsTab() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isCreator = user ? isCreatorRole(user.role) : false;

  useEffect(() => {
    fetchProjects("team")
      .then((res) => setProjects(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {[1, 2].map((i) => (
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
          <h2 className="text-lg font-semibold text-[#222222]">
            Team Projects
          </h2>
          <p className="mt-0.5 text-sm text-[#717171]">
            {isCreator
              ? "Projects shared with colleagues — everyone contributes artifacts"
              : "Projects your district or agency leader has added you to"}
          </p>
        </div>
        {isCreator && (
          <button className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]">
            + New team project
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {isCreator && <NewProjectCard />}
      </div>

      {projects.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
            👥
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#222222]">
            No team projects
          </h3>
          <p className="mt-1 text-sm text-[#717171]">
            {isCreator
              ? "Create one and invite members to collaborate"
              : "Your leader will add you to a project soon"}
          </p>
        </div>
      )}

      {!isCreator && projects.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#EBEBEB] bg-[#F7F7F7] px-5 py-3 text-sm text-[#717171]">
          You can create your own artifacts inside these projects. Your leader
          can see everything you make here.
        </div>
      )}
    </div>
  );
}
