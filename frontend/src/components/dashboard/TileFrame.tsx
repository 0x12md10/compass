import type { ReactNode } from "react";

interface TileFrameProps {
  title: string;
  loading: boolean;
  error: string | null;
  children: ReactNode;
  /** Optional right-aligned slot next to the title — used for the
   * mascot's "Ask AI about this" entry point (v2 FR-M1). */
  action?: ReactNode;
}

/** Consistent title + independent loading/error states (FR-D5) for every
 * dashboard tile, regardless of what it renders once data arrives. */
export function TileFrame({ title, loading, error, children, action }: TileFrameProps) {
  return (
    <div
      data-tile-title={title}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-[var(--text-muted)]">{title}</div>
        {action}
      </div>
      {loading && <div className="text-sm text-[var(--text-muted)]">Loading...</div>}
      {!loading && error && (
        <div className="rounded-lg border border-[#e34948]/30 bg-[#e34948]/10 p-3 text-xs text-[#e34948]">
          {error}
        </div>
      )}
      {!loading && !error && children}
    </div>
  );
}
