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
    <nav className="flex items-center justify-between border-b border-[#E2DDD4] bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-base font-black tracking-tight text-[#D0103A]">
          CRAFT
        </span>
        <span className="rounded-full border border-[#9FE1CB] bg-[#E8F6F1] px-3 py-0.5 text-xs font-bold text-[#0E6B50]">
          Agent
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D0103A] text-[10px] font-bold text-white">
          {initials}
        </div>
        <span className="text-xs text-[#9C9A92]">{user.name}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="h-7 px-2 text-[10px] text-[#9C9A92] hover:text-[#5C5A54]"
        >
          Sign out
        </Button>
      </div>
    </nav>
  );
}
