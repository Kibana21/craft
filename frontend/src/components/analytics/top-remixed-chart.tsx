"use client";

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
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-36 animate-pulse rounded bg-[#F7F7F7]" />
            <div
              className="h-4 animate-pulse rounded bg-[#F7F7F7]"
              style={{ width: `${(6 - i) * 14}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[#B0B0B0]">
        No remixed items yet
      </div>
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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EBEBEB" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#B0B0B0" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#717171" }}
          width={120}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #EBEBEB", fontSize: 12 }}
          formatter={(value) => [value, "Remixes"]}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="remixes" fill="#D0103A" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
