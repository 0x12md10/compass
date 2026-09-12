import { ChartRenderer } from "@/components/charts/ChartRenderer";
import type { ChartType } from "@/components/charts/types";

import { TileFrame } from "./TileFrame";
import { useDashboardTile } from "./useDashboardTile";

interface ChartTileCardProps {
  title: string;
  path: string;
  chartType: ChartType;
  xKey?: string;
  yKey?: string;
  days?: number;
  /** Only set when this tile's bar categories ARE a status — see statusColors.ts. */
  colorForCategory?: (category: string) => string;
}

/** For the bar/line dashboard tiles — the chart shape is known statically
 * per tile (unlike v1's /ask, where chart_type comes back from the
 * backend), so it's passed in directly rather than inferred. */
export function ChartTileCard({ title, path, chartType, xKey, yKey, days, colorForCategory }: ChartTileCardProps) {
  const { data, loading, error } = useDashboardTile(path, days);

  return (
    <TileFrame title={title} loading={loading} error={error}>
      {data && (
        <ChartRenderer
          chart={{ chart_type: chartType, x_key: xKey, y_key: yKey }}
          result={{ columns: data.columns, rows: data.rows }}
          colorForCategory={colorForCategory}
        />
      )}
    </TileFrame>
  );
}
