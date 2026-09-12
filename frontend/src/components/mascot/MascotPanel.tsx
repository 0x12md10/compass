"use client";

import { useState, type FormEvent } from "react";

import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { askQuestion, type AskResponse } from "@/lib/api";

import { CompassAvatar, type CompassState } from "./CompassAvatar";
import { useMascot } from "./MascotContext";

const MASCOT_NAME = "Compass";

/** One question, one answer, no chaining (FR-M2) — submitting a new
 * question replaces the previous result rather than appending to a
 * history. This is a different interaction model from v1's ask bar
 * (which keeps a running list) by design: the mascot is a bounded,
 * single-turn analyst, not a chat log. */
export function MascotPanel() {
  const { isOpen, context, tileName, closeMascot } = useMascot();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

  if (!isOpen) return null;

  const compassState: CompassState = loading ? "thinking" : result ? "talking" : "idle";

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await askQuestion(trimmed, context ?? undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setQuestion("");
    setResult(null);
    setError(null);
    closeMascot();
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 flex max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:w-96">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CompassAvatar state={compassState} size={40} />
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">{MASCOT_NAME}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {tileName ? `Looking at: ${tileName}` : "Your business analyst"}
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          aria-label="Close"
          className="text-lg leading-none text-[var(--text-muted)] hover:text-[var(--foreground)]"
        >
          &times;
        </button>
      </div>

      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={tileName ? `Ask about ${tileName}...` : "Ask me anything about your data..."}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-lg bg-[var(--accent-strong)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "..." : "Ask"}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brand-silver)] border-t-[var(--accent)]" />
            {MASCOT_NAME} is looking into it...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-[#e34948]/30 bg-[#e34948]/10 p-3 text-sm text-[#e34948]">
            {error}
          </div>
        )}

        {!loading && result && result.refusal_reason && (
          <div className="rounded-lg border border-[#eda100]/30 bg-[#eda100]/10 p-3 text-sm text-[var(--foreground)]">
            {result.refusal_reason}
          </div>
        )}

        {!loading && !error && !result && (
          <p className="text-sm text-[var(--text-muted)]">
            {tileName
              ? `Ask a question and I'll dig into the numbers behind ${tileName}.`
              : "Ask me a question about your business data and I'll find the answer."}
          </p>
        )}

        {!loading && result && !result.refusal_reason && (
          <div className="flex flex-col gap-3">
            {result.explanation && (
              <p className="text-sm text-[var(--text-muted)]">{result.explanation}</p>
            )}

            {result.columns && result.rows && result.chart_type && (
              <ChartRenderer
                chart={{ chart_type: result.chart_type, x_key: result.x_key, y_key: result.y_key }}
                result={{ columns: result.columns, rows: result.rows }}
              />
            )}

            {result.sql && (
              <details>
                <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)] select-none">
                  Show generated SQL
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--foreground)]">
                  {result.sql}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
