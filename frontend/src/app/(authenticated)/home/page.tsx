"use client";

import { Suspense } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/components/providers/auth-provider";
import { CreatorHome } from "@/components/home/creator-home";
import { AgentHome } from "@/components/home/agent-home";
import { isCreatorRole } from "@/lib/auth";

function HomeContent() {
  const { user } = useAuth();

  if (!user) return null;

  return isCreatorRole(user.role) ? <CreatorHome /> : <AgentHome />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: "flex",
            height: 256,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ fontSize: "0.875rem", color: "#9C9A92" }}>
            Loading...
          </Typography>
        </Box>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
