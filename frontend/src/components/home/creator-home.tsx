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
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-[28px] font-bold text-[#222222]">Welcome back</h1>
        <p className="mt-1 text-base text-[#717171]">
          Manage your campaigns and brand content
        </p>
      </div>

      {/* Underline tabs */}
      <div className="mb-10 flex gap-6 border-b border-[#EBEBEB]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`pb-3 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? "border-b-2 border-[#222222] text-[#222222] font-semibold"
                : "text-[#717171] hover:text-[#222222]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "my-projects" && <MyProjectsTab />}
        {activeTab === "team-projects" && <TeamProjectsTab />}
        {activeTab === "brand-library" && <BrandLibraryTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
