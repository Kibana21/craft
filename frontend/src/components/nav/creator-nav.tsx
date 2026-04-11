"use client";

import Link from "next/link";
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
    <nav className="sticky top-0 z-50 bg-white border-b border-[#EBEBEB]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black tracking-tight text-[#D0103A]">
            CRAFT
          </span>
          <span className="rounded-full bg-[#FFF0F3] px-3 py-1 text-xs font-semibold text-[#D0103A]">
            Creator
          </span>
          {user.role === "brand_admin" && (
            <div className="ml-4 hidden items-center gap-1 sm:flex">
              <Link href="/brand-library" className="rounded-lg px-3 py-1.5 text-sm text-[#717171] transition-colors hover:bg-[#F7F7F7] hover:text-[#222222]">
                Library
              </Link>
              <Link href="/compliance/rules" className="rounded-lg px-3 py-1.5 text-sm text-[#717171] transition-colors hover:bg-[#F7F7F7] hover:text-[#222222]">
                Rules
              </Link>
              <Link href="/compliance/documents" className="rounded-lg px-3 py-1.5 text-sm text-[#717171] transition-colors hover:bg-[#F7F7F7] hover:text-[#222222]">
                Documents
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#222222] text-xs font-bold text-white">
              {initials}
            </div>
            <span className="hidden text-sm text-[#484848] sm:block">
              {user.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-xs text-[#717171] hover:bg-[#F7F7F7] hover:text-[#222222]"
          >
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
