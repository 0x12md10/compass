"use client";

import { useEffect, useState } from "react";

import { fetchDashboardTile, type DashboardTileResult } from "@/lib/dashboardApi";

/** Each tile fetches and fails independently (v2/REQUIREMENTS.md FR-D5) —
 * one tile's error never touches another tile's state. */
export function useDashboardTile(path: string, days?: number) {
  const [data, setData] = useState<DashboardTileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDashboardTile(path, days !== undefined ? { days } : undefined)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this tile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, days]);

  return { data, loading, error };
}
