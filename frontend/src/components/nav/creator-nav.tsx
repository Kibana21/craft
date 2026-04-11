"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { btn, nav } from "@/lib/ui";

const NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/brand-library", label: "Library" },
  { href: "/brand-kit", label: "Brand Kit" },
  { href: "/compliance/rules", label: "Rules" },
  { href: "/compliance/documents", label: "Documents" },
];

export function CreatorNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <header className={nav.root}>
      <div className={nav.inner}>

        {/* Logo */}
        <Link href="/home" className="mr-4 flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D0103A]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
          <span className="text-[17px] font-bold text-[#1F1F1F] tracking-tight">CRAFT</span>
        </Link>

        {/* Nav links — brand_admin only */}
        {user.role === "brand_admin" && (
          <nav className="hidden items-center md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  (link.href === "/home" ? pathname === "/home" : pathname.startsWith(link.href))
                    ? nav.linkActive
                    : nav.link
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex-1" />

        {/* Search */}
        <button className={btn.icon} aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        {/* Avatar */}
        <button
          onClick={logout}
          title={`${user.name} · Sign out`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EAED] text-[12px] font-semibold text-[#3C4043] transition-colors hover:bg-[#DADCE0]"
        >
          {initials}
        </button>

      </div>
    </header>
  );
}
