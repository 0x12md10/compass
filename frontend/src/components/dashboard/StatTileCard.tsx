import { StatTile } from "@/components/charts/StatTile";
import { AskAiButton } from "@/components/mascot/AskAiButton";

import { useDashboardTile } from "./useDashboardTile";

interface StatTileCardProps {
  title: string;
  path: string;
  format?: (value: string | number | null) => string | number;
  /** Mascot context (v2 FR-M1) — omit to not show "Ask AI about this" on this tile. */
  askAiContext?: string;
  /** Hero treatment for the headline point-in-time figures (MRR, overdue rate). */
  hero?: boolean;
}

/** For the point-in-time scalar tiles (MRR, overdue rate) — these need
 * custom currency/percent formatting that the generic ChartRenderer's
 * "stat" branch doesn't apply, so they render StatTile directly rather
 * than going through ChartRenderer. StatTile already renders its own
 * labeled box, so this doesn't use TileFrame (which would double the
 * title/border) — it mirrors TileFrame's loading/error look manually.
 */
export function StatTileCard({ title, path, format, askAiContext, hero }: StatTileCardProps) {
  const { data, loading, error } = useDashboardTile(path);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#e34948]/30 bg-[#e34948]/10 p-6 text-xs text-[#e34948]">
        {error}
      </div>
    );
  }

  const raw = data?.rows[0]?.[0] ?? null;
  const value = format ? format(raw) : (raw ?? "—");
  return (
    <div className="relative">
      <StatTile label={title} value={value} hero={hero} />
      {askAiContext && (
        <div className="absolute right-4 top-4">
          <AskAiButton tileName={title} context={askAiContext} />
        </div>
      )}
    </div>
  );
}
