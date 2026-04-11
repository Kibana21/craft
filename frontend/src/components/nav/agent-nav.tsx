"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function AgentNav() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#EBEBEB]">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-tight text-[#D0103A]">
            CRAFT
          </span>
          <span className="rounded-full bg-[#F0FFF0] px-3 py-1 text-xs font-semibold text-[#008A05]">
            Agent
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D0103A] text-xs font-bold text-white">
            {initials}
          </div>
          <span className="text-sm text-[#484848]">{user.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-xs text-[#717171] hover:text-[#222222]"
          >
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
