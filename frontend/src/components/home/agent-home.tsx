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
    <div className="pb-16">
      {/* Quick Create */}
      <QuickCreateStrip />

      {/* Underline tabs */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex gap-6 border-b border-[#EBEBEB]">
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
          </div>
        </div>
      </div>

      {/* Gamification — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <GamificationStrip />
      </div>
    </div>
  );
}
