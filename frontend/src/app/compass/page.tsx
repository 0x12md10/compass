"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { CompassMascot3D, type CompassState } from "@/components/mascot/CompassMascot3D";
import { AppShell } from "@/components/shell/AppShell";
import { askQuestion, type AskResponse } from "@/lib/api";

interface Turn {
  id: number;
  question: string;
  status: "loading" | "done" | "error";
  response?: AskResponse;
  error?: string;
}

const EXAMPLE_PROMPTS = [
  "What's our current MRR?",
  "Which country has the most customers?",
  "Show monthly revenue for the last 6 months.",
  "How many customers churned this year?",
];

export default function CompassChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const isLoading = turns.some((t) => t.status === "loading");
  const lastTurn = turns[turns.length - 1];
  const headerState: CompassState = isLoading ? "thinking" : lastTurn?.status === "done" ? "talking" : "idle";

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const id = Date.now();
    setTurns((prev) => [...prev, { id, question: trimmed, status: "loading" }]);
    setInput("");

    try {
      const response = await askQuestion(trimmed);
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done", response } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: "error", error: message } : t)));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-64px)] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
            {turns.length === 0 ? (
              <div className="flex flex-1 flex-col items-center gap-5 py-16 text-center">
                <CompassMascot3D state="idle" size={96} />
                <div>
                  <h1 className="text-xl font-semibold text-[var(--foreground)]">Ask Compass</h1>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Your business analyst — ask a question about your data, in plain English.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((turn) => (
                <div key={turn.id} className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--accent-strong)] px-4 py-2.5 text-sm text-white">
                      {turn.question}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <CompassMascot3D
                      state={turn.status === "loading" ? "thinking" : "talking"}
                      size={36}
                    />
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] p-4">
                      {turn.status === "loading" && (
                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brand-silver)] border-t-[var(--accent)]" />
                          Compass is looking into it...
                        </div>
                      )}

                      {turn.status === "error" && (
                        <div className="text-sm text-[#e34948]">{turn.error}</div>
                      )}

                      {turn.status === "done" && turn.response?.refusal_reason && (
                        <div className="rounded-lg border border-[#eda100]/30 bg-[#eda100]/10 p-3 text-sm text-[var(--foreground)]">
                          {turn.response.refusal_reason}
                        </div>
                      )}

                      {turn.status === "done" && turn.response && !turn.response.refusal_reason && (
                        <div className="flex flex-col gap-3">
                          {turn.response.explanation && (
                            <p className="text-sm text-[var(--foreground)]">{turn.response.explanation}</p>
                          )}

                          {turn.response.columns && turn.response.rows && turn.response.chart_type && (
                            <ChartRenderer
                              chart={{
                                chart_type: turn.response.chart_type,
                                x_key: turn.response.x_key,
                                y_key: turn.response.y_key,
                              }}
                              result={{ columns: turn.response.columns, rows: turn.response.rows }}
                            />
                          )}

                          {turn.response.sql && (
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)] select-none">
                                Show generated SQL
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--foreground)]">
                                {turn.response.sql}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
          <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] pl-2">
              <CompassMascot3D state={headerState} size={28} />
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Compass..."
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
