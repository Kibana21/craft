"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { CreatorNav } from "@/components/nav/creator-nav";
import { AgentNav } from "@/components/nav/agent-nav";
import { isCreatorRole } from "@/lib/auth";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#D0103A]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
          <p className="text-[13px] text-[#9AA0A6]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isCreator = isCreatorRole(user.role);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {isCreator ? <CreatorNav /> : <AgentNav />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
