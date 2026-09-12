export interface DashboardTileResult {
  columns: string[];
  rows: (string | number | null)[][];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchDashboardTile(
  path: string,
  params?: Record<string, string | number>
): Promise<DashboardTileResult> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // fall back to the generic message above
    }
    throw new Error(detail);
  }

  return res.json();
}
