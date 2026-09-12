export interface AskResponse {
  question: string;
  sql: string | null;
  columns: string[] | null;
  rows: (string | number | null)[][] | null;
  chart_type: "stat" | "bar" | "line" | "table" | null;
  x_key: string | null;
  y_key: string | null;
  explanation: string | null;
  refusal_reason: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function askQuestion(question: string, context?: string): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore — fall back to the generic message above
    }
    throw new Error(detail);
  }

  return res.json();
}
