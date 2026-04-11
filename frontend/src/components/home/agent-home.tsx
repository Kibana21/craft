"use client";

import { useSearchParams, useRouter } from "next/navigation";
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
    <div className="mx-auto max-w-lg">
      {/* Quick Create */}
      <QuickCreateStrip />

      {/* Tabs */}
      <div className="flex border-b border-[#E2DDD4] px-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`border-b-2 px-3 py-2.5 text-[11px] transition-colors ${
              activeTab === tab.key
                ? "border-[#D0103A] font-semibold text-[#1A1A18]"
                : "border-transparent text-[#9C9A92] hover:text-[#5C5A54]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "my-projects" && <MyProjectsTab />}
        {activeTab === "team-projects" && <TeamProjectsTab />}
        {activeTab === "brand-library" && <BrandLibraryTab />}
      </div>

      {/* Gamification */}
      <div className="fixed bottom-0 left-0 right-0">
        <GamificationStrip />
      </div>
    </div>
  );
}
