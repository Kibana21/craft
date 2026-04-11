"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function CreatorNav() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <nav className="flex items-center justify-between bg-[#1A1A18] px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-base font-black tracking-tight text-[#D0103A]">
          CRAFT
        </span>
        <span className="rounded-full bg-[rgba(208,16,58,0.3)] px-3 py-0.5 text-xs font-bold text-[#FF6B8A]">
          Creator
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user.role === "brand_admin" && (
          <span className="text-xs text-white/30">Brand Kit · Analytics</span>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#534AB7] text-[10px] font-bold text-white">
            {initials}
          </div>
          <span className="text-xs text-white/50">{user.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="h-7 px-2 text-[10px] text-white/30 hover:bg-white/5 hover:text-white/60"
        >
          Sign out
        </Button>
      </div>
    </nav>
  );
}
