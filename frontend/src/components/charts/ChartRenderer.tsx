import { BarChartView } from "./BarChartView";
import { DataTable } from "./DataTable";
import { LineChartView } from "./LineChartView";
import { StatTile } from "./StatTile";
import type { ChartSpec, QueryResult } from "./types";

interface ChartRendererProps {
  chart: ChartSpec;
  result: QueryResult;
  /** Only set when a bar chart's categories ARE a status (see
   * statusColors.ts) — omitted everywhere else, which uses the single
   * chart accent hue. */
  colorForCategory?: (category: string) => string;
}

/** Picks the rendered view from the backend's chart_type heuristic (Phase 4). */
export function ChartRenderer({ chart, result, colorForCategory }: ChartRendererProps) {
  const { columns, rows } = result;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--chart-surface)] p-6 text-sm text-[var(--text-muted)]">
        No results for this question.
      </div>
    );
  }

  if (chart.chart_type === "stat") {
    return <StatTile label={columns[0]} value={rows[0][0] ?? "—"} />;
  }

  const asRecords = () => rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));

  if (chart.chart_type === "bar" && chart.x_key && chart.y_key) {
    return (
      <BarChartView data={asRecords()} xKey={chart.x_key} yKey={chart.y_key} colorForCategory={colorForCategory} />
    );
  }

  if (chart.chart_type === "line" && chart.x_key && chart.y_key) {
    return <LineChartView data={asRecords()} xKey={chart.x_key} yKey={chart.y_key} />;
  }

  return <DataTable columns={columns} rows={rows} />;
}
