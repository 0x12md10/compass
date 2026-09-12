import { ChartRenderer } from "@/components/charts/ChartRenderer";
import type { ChartType } from "@/components/charts/types";
import { AskAiButton } from "@/components/mascot/AskAiButton";

import { TileFrame } from "./TileFrame";
import { useDashboardTile } from "./useDashboardTile";

interface ChartTileCardProps {
  title: string;
  path: string;
  chartType: ChartType;
  xKey?: string;
  yKey?: string;
  days?: number;
  /** Mascot context (v2 FR-M1) — omit to not show "Ask AI about this" on this tile. */
  askAiContext?: string;
  /** Only set when this tile's bar categories ARE a status — see statusColors.ts. */
  colorForCategory?: (category: string) => string;
}

/** For the bar/line dashboard tiles — the chart shape is known statically
 * per tile (unlike v1's /ask, where chart_type comes back from the
 * backend), so it's passed in directly rather than inferred. */
export function ChartTileCard({
  title,
  path,
  chartType,
  xKey,
  yKey,
  days,
  askAiContext,
  colorForCategory,
}: ChartTileCardProps) {
  const { data, loading, error } = useDashboardTile(path, days);

  return (
    <TileFrame
      title={title}
      loading={loading}
      error={error}
      action={askAiContext && <AskAiButton tileName={title} context={askAiContext} />}
    >
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
