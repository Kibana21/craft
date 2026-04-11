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
      <div>
        <div className="mb-5 h-4 w-24 animate-pulse rounded bg-[#F1F3F4]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#E8EAED] p-5">
              <div className="mb-4 h-12 w-12 animate-pulse rounded-xl bg-[#F1F3F4]" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-[#F1F3F4]" />
              <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-[#F8F9FA]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-5 text-[16px] font-semibold text-[#1F1F1F]">Recent projects</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <NewProjectCard onClick={() => router.push("/projects/new")} />
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => router.push(`/projects/${project.id}`)}
          />
        ))}
      </div>

      {projects.length === 0 && (
        <div className="mt-20 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F3F4]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#80868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#1F1F1F]">No projects yet</p>
          <p className="mt-1 text-[13px] text-[#80868B]">Create your first campaign to get started</p>
        </div>
      )}
    </div>
  );
}
