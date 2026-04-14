"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";

export function AgentNav() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppBar position="sticky">
      <Toolbar sx={{ maxWidth: 768, mx: "auto", width: "100%", gap: 1.5 }}>

        {/* Brand */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            component="span"
            sx={{
              fontSize: "18px",
              fontWeight: 800,
              color: "#D0103A",
              letterSpacing: "-0.5px",
            }}
          >
            CRAFT
          </Box>

          <Chip
            label="Agent"
            size="small"
            color="success"
            sx={{
              height: 22,
              fontSize: "11px",
              fontWeight: 700,
              bgcolor: "#E6F4EA",
              color: "#188038",
            }}
          />

          <Button
            component={Link}
            href="/my-studio"
            variant="text"
            size="small"
            sx={{
              fontSize: "14px",
              color: "#5F6368",
              px: 1.5,
              "&:hover": { color: "#1F1F1F", bgcolor: "#F1F3F4" },
            }}
          >
            My Studio
          </Button>

          <Button
            component={Link}
            href="/leaderboard"
            variant="text"
            size="small"
            sx={{
              fontSize: "14px",
              color: "#5F6368",
              px: 1.5,
              "&:hover": { color: "#1F1F1F", bgcolor: "#F1F3F4" },
            }}
          >
            Leaderboard
          </Button>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* User info + sign out */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: "#D0103A",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box
            component="span"
            sx={{ fontSize: "14px", fontWeight: 500, color: "#1F1F1F" }}
          >
            {user.name}
          </Box>
          <Button
            onClick={logout}
            variant="outlined"
            size="small"
            sx={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#D0103A",
              borderColor: "#D0103A",
              px: 1.75,
              "&:hover": {
                bgcolor: "#FFF0F3",
                borderColor: "#D0103A",
              },
            }}
          >
            Sign out
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
