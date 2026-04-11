"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ActivityDataPoint } from "@/types/analytics";

interface ActivityChartProps {
  data: ActivityDataPoint[];
  isLoading?: boolean;
}

export function ActivityChart({ data, isLoading }: ActivityChartProps) {
  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-[#F7F7F7]" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[#B0B0B0]">
        No activity data yet
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#B0B0B0" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#B0B0B0" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #EBEBEB", fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="created"
          name="Created"
          stroke="#D0103A"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="exported"
          name="Exported"
          stroke="#1B9D74"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
