"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { MyProjectsTab } from "./tabs/my-projects-tab";
import { TeamProjectsTab } from "./tabs/team-projects-tab";
import { BrandLibraryTab } from "./tabs/brand-library-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";

const TABS = [
  { key: "my-projects",   label: "My projects" },
  { key: "team-projects", label: "Team projects" },
  { key: "brand-library", label: "Brand library" },
  { key: "analytics",     label: "Analytics" },
];

export function CreatorHome() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const activeTab = searchParams.get("tab") || "my-projects";
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    router.push(`/home?tab=${TABS[newIndex].key}`, { scroll: false });
  };

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>

      {/* Welcome banner — light, airy, beautiful */}
      <Box
        sx={{
          mb: 4,
          borderRadius: "20px",
          overflow: "hidden",
          position: "relative",
          background: "linear-gradient(135deg, #FFF0F4 0%, #FFFBFC 55%, #FFF5ED 100%)",
          border: "1px solid rgba(208,16,58,0.10)",
          px: { xs: 3, sm: 5 },
          py: { xs: 3.5, sm: 4.5 },
        }}
      >
        {/* Decorative soft circle */}
        <Box
          sx={{
            position: "absolute",
            right: -60,
            top: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(208,16,58,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            right: 80,
            bottom: -40,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(208,16,58,0.04) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <Typography
          variant="overline"
          sx={{
            color: "#D0103A",
            mb: 0.75,
            display: "block",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          Creator Studio
        </Typography>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: "22px", sm: "26px" },
            fontWeight: 700,
            color: "#1F1F1F",
            lineHeight: 1.2,
            mb: 0.75,
          }}
        >
          Welcome back, {firstName}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "#80868B", fontSize: "14px" }}
        >
          Your projects and campaigns, all in one place.
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeIndex === -1 ? 0 : activeIndex}
        onChange={handleTabChange}
        sx={{ mb: 4 }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} label={t.label} disableRipple />
        ))}
      </Tabs>

      {activeTab === "my-projects"   && <MyProjectsTab />}
      {activeTab === "team-projects" && <TeamProjectsTab />}
      {activeTab === "brand-library" && <BrandLibraryTab />}
      {activeTab === "analytics"     && <AnalyticsTab />}
    </Box>
  );
}
