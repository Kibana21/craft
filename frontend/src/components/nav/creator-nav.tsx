"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";

const NAV_LINKS = [
  { href: "/brand-library", label: "Library" },
  { href: "/brand-kit", label: "Brand Kit" },
  { href: "/compliance/rules", label: "Rules" },
  { href: "/compliance/documents", label: "Documents" },
];

export function CreatorNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8EAED] bg-white">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-6">

        {/* Logo */}
        <Link href="/home" className="flex shrink-0 items-center gap-2 mr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D0103A]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L3 19h4l5-10 5 10h4L12 3z" fill="white" />
              <path d="M8.5 15h7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-[#1F1F1F]">CRAFT</span>
        </Link>

        {/* Nav links — admin only */}
        {user.role === "brand_admin" && (
          <nav className="hidden items-center md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? "bg-[#F1F3F4] text-[#1F1F1F]"
                    : "text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#1F1F1F]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search icon */}
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#5F6368] transition-colors hover:bg-[#F1F3F4]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        {/* New project button */}
        <button
          onClick={() => router.push("/projects/new")}
          className="flex items-center gap-1.5 rounded-full bg-[#D0103A] px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#B80E33]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          Create new
        </button>

        {/* Avatar */}
        <button
          onClick={logout}
          title={`${user.name} · Sign out`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D0103A] text-[11px] font-bold text-white transition-opacity hover:opacity-85"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
