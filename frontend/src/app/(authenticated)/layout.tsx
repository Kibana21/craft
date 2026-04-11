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
      <div className="flex min-h-screen items-center justify-center bg-[#F0EDE6]">
        <div className="text-center">
          <h1 className="text-xl font-black text-[#D0103A]">CRAFT</h1>
          <p className="mt-2 text-xs text-[#9C9A92]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isCreator = isCreatorRole(user.role);

  return (
    <div className="flex min-h-screen flex-col bg-[#F0EDE6]">
      {isCreator ? <CreatorNav /> : <AgentNav />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
