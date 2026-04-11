"use client";

import { Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { CreatorHome } from "@/components/home/creator-home";
import { AgentHome } from "@/components/home/agent-home";
import { isCreatorRole } from "@/lib/auth";

function HomeContent() {
  const { user } = useAuth();

  if (!user) return null;

  return isCreatorRole(user.role) ? <CreatorHome /> : <AgentHome />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-[#9C9A92]">Loading...</p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
