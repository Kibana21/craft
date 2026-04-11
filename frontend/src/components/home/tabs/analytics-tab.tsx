"use client";

import { useEffect, useState } from "react";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { OverviewMetrics } from "@/components/analytics/overview-metrics";
import { TopRemixedChart } from "@/components/analytics/top-remixed-chart";
import { ContentGaps } from "@/components/analytics/content-gaps";
import { ActivityChart } from "@/components/analytics/activity-chart";
import {
  fetchOverview,
  fetchTopRemixed,
  fetchContentGaps,
  fetchActivity,
} from "@/lib/api/analytics";
import type { OverviewMetrics as OverviewMetricsType } from "@/types/analytics";
import type { TopRemixedItem } from "@/types/analytics";
import type { ContentGap } from "@/types/analytics";
import type { ActivityDataPoint } from "@/types/analytics";

export function AnalyticsTab() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("week");
  const [overview, setOverview] = useState<OverviewMetricsType | null>(null);
  const [topRemixed, setTopRemixed] = useState<TopRemixedItem[]>([]);
  const [gaps, setGaps] = useState<ContentGap[]>([]);
  const [activity, setActivity] = useState<ActivityDataPoint[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);

  useEffect(() => {
    setLoadingOverview(true);
    fetchOverview({ period })
      .then(setOverview)
      .catch(() => {})
      .finally(() => setLoadingOverview(false));
  }, [period]);

  useEffect(() => {
    setLoadingCharts(true);
    Promise.all([
      fetchTopRemixed(8),
      fetchContentGaps(),
      fetchActivity(period),
    ])
      .then(([tr, cg, act]) => {
        setTopRemixed(tr.items);
        setGaps(cg.gaps);
        setActivity(act.data);
      })
      .catch(() => {})
      .finally(() => setLoadingCharts(false));
  }, [period]);

  return (
    <div className="space-y-8">
      {/* Header + filters */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#222222]">Analytics</h2>
          <p className="mt-0.5 text-sm text-[#717171]">
            How FSCs are using CRAFT
          </p>
        </div>
        <AnalyticsFilters period={period} onPeriodChange={setPeriod} />
      </div>

      {/* Overview metrics */}
      {overview ? (
        <OverviewMetrics data={overview} isLoading={loadingOverview} />
      ) : (
        <OverviewMetrics
          data={{ assets_created_week: 0, assets_created_month: 0, total_remixes: 0, compliance_rate: 0, active_fscs: 0 }}
          isLoading={loadingOverview}
        />
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activity */}
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-[#222222]">
            Creation &amp; Export Activity
          </h3>
          <ActivityChart data={activity} isLoading={loadingCharts} />
        </div>

        {/* Top remixed */}
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-[#222222]">
            Most Remixed Library Items
          </h3>
          <TopRemixedChart items={topRemixed} isLoading={loadingCharts} />
        </div>
      </div>

      {/* Content gaps */}
      <div className="rounded-xl border border-[#EBEBEB] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#222222]">Content Gaps</h3>
            <p className="mt-0.5 text-xs text-[#717171]">
              Types FSCs create without a library template
            </p>
          </div>
        </div>
        <ContentGaps gaps={gaps} isLoading={loadingCharts} />
      </div>
    </div>
  );
}
