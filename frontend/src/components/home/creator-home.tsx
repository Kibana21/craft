"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { MyProjectsTab } from "./tabs/my-projects-tab";
import { TeamProjectsTab } from "./tabs/team-projects-tab";
import { BrandLibraryTab } from "./tabs/brand-library-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";

const TABS = [
  { key: "my-projects", label: "My projects" },
  { key: "team-projects", label: "Team projects" },
  { key: "brand-library", label: "Brand library" },
  { key: "analytics", label: "Analytics" },
];

export function CreatorHome() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const activeTab = searchParams.get("tab") || "my-projects";

  const setTab = (tab: string) => {
    router.push(`/home?tab=${tab}`, { scroll: false });
  };

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#1F1F1F]">
          Welcome back, {firstName}
        </h1>
      </div>

      {/* Tab row */}
      <div className="mb-8 border-b border-[#E8EAED]">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`relative pb-3 pr-6 text-[13px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-[#D0103A]"
                  : "text-[#5F6368] hover:text-[#1F1F1F]"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#D0103A]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "my-projects" && <MyProjectsTab />}
      {activeTab === "team-projects" && <TeamProjectsTab />}
      {activeTab === "brand-library" && <BrandLibraryTab />}
      {activeTab === "analytics" && <AnalyticsTab />}
    </div>
  );
}
