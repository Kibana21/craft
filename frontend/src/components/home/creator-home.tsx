"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { MyProjectsTab } from "./tabs/my-projects-tab";
import { TeamProjectsTab } from "./tabs/team-projects-tab";
import { BrandLibraryTab } from "./tabs/brand-library-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";

const TABS = [
  { key: "my-projects", label: "My Projects" },
  { key: "team-projects", label: "Team Projects" },
  { key: "brand-library", label: "Brand Library" },
  { key: "analytics", label: "Analytics" },
];

export function CreatorHome() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "my-projects";

  const setTab = (tab: string) => {
    router.push(`/home?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* Tabs */}
      <div className="mb-4 flex border-b border-[#E2DDD4]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`border-b-2 px-4 py-2.5 text-[11px] transition-colors ${
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
      <div className="rounded-xl border border-[#E2DDD4] bg-white p-4">
        {activeTab === "my-projects" && <MyProjectsTab />}
        {activeTab === "team-projects" && <TeamProjectsTab />}
        {activeTab === "brand-library" && <BrandLibraryTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
