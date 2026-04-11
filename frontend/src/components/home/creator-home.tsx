"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { layout, tab, text } from "@/lib/ui";
import { MyProjectsTab } from "./tabs/my-projects-tab";
import { TeamProjectsTab } from "./tabs/team-projects-tab";
import { BrandLibraryTab } from "./tabs/brand-library-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";

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

  const setTab = (key: string) => router.push(`/home?tab=${key}`, { scroll: false });
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className={layout.page}>
      <h1 className={`mb-6 ${text.h1}`}>Welcome back, {firstName}</h1>

      {/* Tabs */}
      <div className={tab.root}>
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={activeTab === t.key ? tab.active : tab.item}
            >
              {t.label}
              {activeTab === t.key && <span className={tab.indicator} />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "my-projects"   && <MyProjectsTab />}
      {activeTab === "team-projects" && <TeamProjectsTab />}
      {activeTab === "brand-library" && <BrandLibraryTab />}
      {activeTab === "analytics"     && <AnalyticsTab />}
    </div>
  );
}
