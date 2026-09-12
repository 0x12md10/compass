"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface LineChartViewProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  yKey: string;
}

export function LineChartView({ data, xKey, yKey }: LineChartViewProps) {
  return (
    <div className="h-72 w-full rounded-lg border border-[var(--border)] bg-[var(--chart-surface)] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="series-1-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-series-1-fill-from)" />
              <stop offset="100%" stopColor="var(--chart-series-1-fill-to)" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} stroke="var(--chart-label)" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} fontSize={12} />
          <YAxis stroke="var(--chart-label)" tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--foreground)" }}
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="var(--chart-series-1)"
            strokeWidth={2}
            fill="url(#series-1-fill)"
            dot={{ r: 3, fill: "var(--chart-series-1)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
