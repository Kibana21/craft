"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { QuickCreateStrip } from "./quick-create-strip";
import { GamificationStrip } from "./gamification-strip";
import { MyProjectsTab } from "./tabs/my-projects-tab";
import { TeamProjectsTab } from "./tabs/team-projects-tab";
import { BrandLibraryTab } from "./tabs/brand-library-tab";

const TABS = [
  { key: "my-projects", label: "My Projects" },
  { key: "team-projects", label: "Team Projects" },
  { key: "brand-library", label: "Brand Library" },
];

export function AgentHome() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "my-projects";

  const setTab = (tab: string) => {
    router.push(`/home?tab=${tab}`, { scroll: false });
  };

  return (
    <Box sx={{ pb: 8 }}>
      {/* Quick Create */}
      <QuickCreateStrip />

      {/* Underline tabs */}
      <Box sx={{ px: 3, py: 4 }}>
        <Box sx={{ mx: "auto", maxWidth: "48rem" }}>
          <Box
            sx={{
              mb: 4,
              display: "flex",
              gap: 3,
              borderBottom: "1px solid #EBEBEB",
            }}
          >
            {TABS.map((tab) => (
              <ButtonBase
                key={tab.key}
                onClick={() => setTab(tab.key)}
                sx={{
                  pb: 1.5,
                  fontSize: "0.875rem",
                  fontWeight: activeTab === tab.key ? 600 : 500,
                  color: activeTab === tab.key ? "#D0103A" : "#717171",
                  borderBottom: activeTab === tab.key ? "2px solid #D0103A" : "2px solid transparent",
                  transition: "all 0.2s",
                  "&:hover": {
                    color: activeTab === tab.key ? "#D0103A" : "#222222",
                  },
                }}
              >
                {tab.label}
              </ButtonBase>
            ))}
          </Box>

          {/* Tab content */}
          <Box>
            {activeTab === "my-projects" && <MyProjectsTab />}
            {activeTab === "team-projects" && <TeamProjectsTab />}
            {activeTab === "brand-library" && <BrandLibraryTab />}
          </Box>
        </Box>
      </Box>

      {/* Gamification — fixed bottom */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
        }}
      >
        <GamificationStrip />
      </Box>
    </Box>
  );
}
