"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface BarChartViewProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  yKey: string;
  /** Only set when a category IS a status (e.g. customer/ticket status) —
   * see statusColors.ts. Omit for a plain ranking/magnitude bar chart,
   * which uses one accent hue per the dataviz skill's categorical rule
   * ("color follows the entity, never its rank"). */
  colorForCategory?: (category: string) => string;
}

export function BarChartView({ data, xKey, yKey, colorForCategory }: BarChartViewProps) {
  return (
    <div className="h-72 w-full rounded-lg border border-[var(--border)] bg-[var(--chart-surface)] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
            cursor={{ fill: "var(--surface-muted)" }}
          />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((row, i) => (
              <Cell
                key={i}
                fill={colorForCategory ? colorForCategory(String(row[xKey])) : "var(--chart-bar-fill)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
