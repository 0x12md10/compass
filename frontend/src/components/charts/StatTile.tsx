interface StatTileProps {
  label: string;
  value: string | number;
  /** Point-in-time headline figures get the larger "hero number" treatment
   * per the dataviz skill ("lead with big-number tiles only when those
   * figures are the point of the page") — MRR and overdue rate are. */
  hero?: boolean;
}

export function StatTile({ label, value, hero = false }: StatTileProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="text-sm font-medium text-[var(--text-muted)]">{label}</div>
      <div
        className={`mt-2 font-semibold tabular-nums text-[var(--foreground)] ${hero ? "text-5xl" : "text-4xl"}`}
      >
        {value}
      </div>
    </div>
  );
}
