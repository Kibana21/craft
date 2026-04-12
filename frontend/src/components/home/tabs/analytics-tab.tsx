"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Header + filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontSize: 18, fontWeight: 600, color: "#1F1F1F" }}>
            Analytics
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 14, color: "#5F6368" }}>
            How FSCs are using CRAFT
          </Typography>
        </Box>
        <AnalyticsFilters period={period} onPeriodChange={setPeriod} />
      </Box>

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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 3,
        }}
      >
        {/* Activity */}
        <Box
          sx={{
            borderRadius: "16px",
            border: "1px solid #F0F0F0",
            bgcolor: "#FFFFFF",
            p: 3,
          }}
        >
          <Typography sx={{ mb: 2, fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
            Creation &amp; Export Activity
          </Typography>
          <ActivityChart data={activity} isLoading={loadingCharts} />
        </Box>

        {/* Top remixed */}
        <Box
          sx={{
            borderRadius: "16px",
            border: "1px solid #F0F0F0",
            bgcolor: "#FFFFFF",
            p: 3,
          }}
        >
          <Typography sx={{ mb: 2, fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
            Most Remixed Library Items
          </Typography>
          <TopRemixedChart items={topRemixed} isLoading={loadingCharts} />
        </Box>
      </Box>

      {/* Content gaps */}
      <Box
        sx={{
          borderRadius: "16px",
          border: "1px solid #F0F0F0",
          bgcolor: "#FFFFFF",
          p: 3,
        }}
      >
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
              Content Gaps
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 12, color: "#5F6368" }}>
              Types FSCs create without a library template
            </Typography>
          </Box>
        </Box>
        <ContentGaps gaps={gaps} isLoading={loadingCharts} />
      </Box>
    </Box>
  );
}
