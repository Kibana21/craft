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
        <h3 className="text-[11px] font-bold text-[#1A1A18]">Team Projects</h3>
        {isCreator && (
          <button className="text-[10px] text-[#D0103A]">
            + New team project
          </button>
        )}
      </div>
      <p className="mb-3 text-[10px] text-[#9C9A92]">
        {isCreator
          ? "Projects shared with colleagues — everyone contributes artifacts"
          : "Projects your district or agency leader has added you to"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {isCreator && <NewProjectCard />}
      </div>
      {projects.length === 0 && (
        <div className="mt-4 text-center">
          <p className="text-2xl">👥</p>
          <p className="mt-2 text-[11px] text-[#9C9A92]">
            {isCreator
              ? "No team projects yet — create one and invite members"
              : "No team projects — your leader will add you to one"}
          </p>
        </div>
      )}
      {!isCreator && projects.length > 0 && (
        <div className="mt-3 rounded-md border border-[#E2DDD4] bg-[#F0EDE6] px-3 py-2 text-[10px] text-[#9C9A92]">
          You can create your own artifacts inside these projects. Your leader
          can see everything you make here.
        </div>
      )}
    </div>
  );
}
