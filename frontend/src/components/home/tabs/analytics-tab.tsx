"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
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
import { queryKeys } from "@/lib/query-keys";

export function AnalyticsTab() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("week");

  const overviewQuery = useQuery({
    queryKey: queryKeys.analyticsOverview(period),
    queryFn: () => fetchOverview({ period }),
  });

  // Three chart queries fire in parallel; each retries/caches independently,
  // so if one errors the others still render. Previously a single Promise.all
  // + .catch() would wipe all three charts on any one failure.
  const [topRemixedQuery, gapsQuery, activityQuery] = useQueries({
    queries: [
      {
        queryKey: ["analytics", "top-remixed", 8] as const,
        queryFn: () => fetchTopRemixed(8),
      },
      {
        queryKey: queryKeys.analyticsContentGaps(),
        queryFn: () => fetchContentGaps(),
      },
      {
        queryKey: queryKeys.analyticsActivity(period, "day"),
        queryFn: () => fetchActivity(period),
      },
    ],
  });

  const overview = overviewQuery.data ?? null;
  const topRemixed = topRemixedQuery.data?.items ?? [];
  const gaps = gapsQuery.data?.gaps ?? [];
  const activity = activityQuery.data?.data ?? [];
  const loadingOverview = overviewQuery.isPending;
  const loadingCharts =
    topRemixedQuery.isPending || gapsQuery.isPending || activityQuery.isPending;

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
