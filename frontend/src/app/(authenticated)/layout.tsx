"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { CreatorNav } from "@/components/nav/creator-nav";
import { AgentNav } from "@/components/nav/agent-nav";
import { isCreatorRole } from "@/lib/auth";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

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
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#FFFFFF",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            bgcolor: "#D0103A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 0.5,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </Box>
        <CircularProgress size={20} thickness={4} />
      </Box>
    );
  }

  if (!user) return null;

  const isCreator = isCreatorRole(user.role);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column", bgcolor: "#FFFFFF" }}>
      {isCreator ? <CreatorNav /> : <AgentNav />}
      <Box component="main" sx={{ flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
