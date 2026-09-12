"use client";

import { useState, type FormEvent } from "react";

import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { askQuestion, type AskResponse } from "@/lib/api";
import { AppShell } from "@/components/shell/AppShell";

interface HistoryItem extends AskResponse {
  id: number;
}

const EXAMPLE_QUESTIONS = [
  "What's our current MRR?",
  "Which country has the most customers?",
  "Show monthly revenue for the last 6 months.",
];

export default function ClassicAskPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    try {
      const result = await askQuestion(trimmed);
      setHistory((prev) => [{ ...result, id: Date.now() }, ...prev]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="px-4 py-10 sm:px-6">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Classic Ask
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)] sm:text-base">
              Ask your database a question in plain English.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What's our current MRR?"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="rounded-lg bg-[var(--accent-strong)] px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              {loading ? "Asking..." : "Ask"}
            </button>
          </form>

          {history.length === 0 && !loading && (
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand-silver)] border-t-[var(--accent)]" />
              Thinking through your question...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#e34948]/30 bg-[#e34948]/10 p-4 text-sm text-[#e34948]">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-5">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="text-sm font-medium text-[var(--foreground)]">{item.question}</div>

                {item.refusal_reason ? (
                  <div className="mt-3 rounded-lg border border-[#eda100]/30 bg-[#eda100]/10 p-4 text-sm text-[var(--foreground)]">
                    {item.refusal_reason}
                  </div>
                ) : (
                  <>
                    {item.explanation && (
                      <p className="mt-3 text-sm text-[var(--text-muted)]">{item.explanation}</p>
                    )}

                    {item.columns && item.rows && item.chart_type && (
                      <div className="mt-4">
                        <ChartRenderer
                          chart={{ chart_type: item.chart_type, x_key: item.x_key, y_key: item.y_key }}
                          result={{ columns: item.columns, rows: item.rows }}
                        />
                      </div>
                    )}

                    {item.sql && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)] select-none">
                          Show generated SQL
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--foreground)]">
                          {item.sql}
                        </pre>
                      </details>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
