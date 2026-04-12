"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TopRemixedItem } from "@/types/analytics";

interface TopRemixedChartProps {
  items: TopRemixedItem[];
  isLoading?: boolean;
}

export function TopRemixedChart({ items, isLoading }: TopRemixedChartProps) {
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Skeleton
              variant="rectangular"
              width={144}
              height={16}
              sx={{ borderRadius: "4px", bgcolor: "#F7F7F7", flexShrink: 0 }}
            />
            <Skeleton
              variant="rectangular"
              width={`${(6 - i) * 14}%`}
              height={16}
              sx={{ borderRadius: "4px", bgcolor: "#F7F7F7" }}
            />
          </Box>
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box
        sx={{
          height: 160,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: 14, color: "#B0B0B0" }}>
          No remixed items yet
        </Typography>
      </Box>
    );
  }

  const data = items.slice(0, 8).map((item) => ({
    name:
      item.artifact_name.length > 24
        ? item.artifact_name.slice(0, 22) + "…"
        : item.artifact_name,
    remixes: item.remix_count,
    product: item.product || "—",
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="#EBEBEB"
        />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#B0B0B0" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#717171" }}
          width={120}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #EBEBEB",
            fontSize: 12,
          }}
          formatter={(value) => [value, "Remixes"]}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="remixes" fill="#D0103A" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
