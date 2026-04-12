"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";

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

  const initials = user.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppBar position="sticky">
      <Toolbar sx={{ maxWidth: 1200, mx: "auto", width: "100%", gap: 1 }}>

        {/* Logo */}
        <Box
          component={Link}
          href="/home"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            mr: 2,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              bgcolor: "#D0103A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#1F1F1F",
              letterSpacing: "-0.3px",
            }}
          >
            CRAFT
          </Box>
        </Box>

        {/* Nav links — brand_admin only */}
        {user.role === "brand_admin" && (
          <Box
            component="nav"
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}
          >
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/home"
                  ? pathname === "/home"
                  : pathname.startsWith(link.href);
              return (
                <Button
                  key={link.href}
                  component={Link}
                  href={link.href}
                  variant="text"
                  size="small"
                  sx={{
                    color: isActive ? "#1F1F1F" : "#5F6368",
                    fontWeight: isActive ? 600 : 500,
                    bgcolor: isActive ? "#F1F3F4" : "transparent",
                    px: 2,
                    py: 0.875,
                    fontSize: "14px",
                    "&:hover": {
                      bgcolor: "#F1F3F4",
                      color: "#1F1F1F",
                    },
                  }}
                >
                  {link.label}
                </Button>
              );
            })}
          </Box>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Search */}
        <IconButton aria-label="Search" size="medium" sx={{ color: "#5F6368" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </IconButton>

        {/* Avatar */}
        <Avatar
          onClick={logout}
          title={`${user.name} · Sign out`}
          sx={{
            width: 36,
            height: 36,
            bgcolor: "#F1F3F4",
            color: "#3C4043",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            "&:hover": { bgcolor: "#DADCE0" },
            transition: "background-color 0.15s ease",
          }}
        >
          {initials}
        </Avatar>
      </Toolbar>
    </AppBar>
  );
}
