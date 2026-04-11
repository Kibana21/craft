"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectCard, NewProjectCard } from "@/components/cards/project-card";
import { fetchProjects } from "@/lib/api/projects";
import { isCreatorRole } from "@/lib/auth";
import type { Project } from "@/types/project";

export function TeamProjectsTab() {
  const { user } = useAuth();
  const router = useRouter();
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#E8EAED] p-5">
            <div className="mb-4 h-12 w-12 animate-pulse rounded-xl bg-[#F1F3F4]" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-[#F1F3F4]" />
            <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-[#F8F9FA]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[#1F1F1F]">Team projects</h2>
        {isCreator && (
          <button className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] px-3.5 py-1.5 text-[13px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            New team project
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onClick={() => router.push(`/projects/${project.id}`)} />
        ))}
        {isCreator && <NewProjectCard />}
      </div>

      {projects.length === 0 && (
        <div className="mt-20 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F3F4] text-2xl">👥</div>
          <p className="text-[15px] font-medium text-[#1F1F1F]">No team projects</p>
          <p className="mt-1 text-[13px] text-[#80868B]">
            {isCreator ? "Create one and invite members to collaborate" : "Your leader will add you to a project soon"}
          </p>
        </div>
      )}

      {!isCreator && projects.length > 0 && (
        <p className="mt-6 text-[12px] text-[#80868B]">
          You can create artifacts inside these projects. Your leader can see everything you make here.
        </p>
      )}
    </div>
  );
}
