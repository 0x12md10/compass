"use client";

import { useState } from "react";

import { customerStatusColor, ticketStatusColor } from "@/components/charts/statusColors";
import { ChartTileCard } from "@/components/dashboard/ChartTileCard";
import { StatTileCard } from "@/components/dashboard/StatTileCard";
import { MascotPanel } from "@/components/mascot/MascotPanel";
import { MascotProvider } from "@/components/mascot/MascotContext";
import { MascotToggleButton } from "@/components/mascot/MascotToggleButton";
import { AppShell } from "@/components/shell/AppShell";

const RANGE_OPTIONS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 365 days", days: 365 },
];

function formatCurrency(value: string | number | null): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: string | number | null): string {
  const n = Number(value ?? 0);
  return `${n.toFixed(1)}%`;
}

export default function Home() {
  const [days, setDays] = useState(365);

  // Mascot context strings (v2 FR-M1/FR-M3) — always include the ACTUAL
  // selected range for range-filterable tiles, not just a generic
  // description. D3's live testing found that a vague context ("showing
  // signups within the selected range") caused the model to correctly
  // refuse for lacking a concrete date range — so the real `days` value
  // is baked in here, not left implicit.
  const revenueTrendContext = `The user is looking at the "Monthly Revenue Trend" dashboard tile, which shows total paid revenue per month over the last ${days} days.`;
  const signupsByMonthContext = `The user is looking at the "Signups by Month" dashboard tile, which shows new customer signups per month over the last ${days} days.`;
  const signupsByCountryContext = `The user is looking at the "Signups by Country" dashboard tile, which shows the top 10 countries by new customer signups over the last ${days} days.`;
  const churnByPlanContext = `The user is looking at the "Churn by Plan" dashboard tile, which shows how many customers churned on each pricing plan within the last ${days} days.`;
  const ticketVolumeContext = `The user is looking at the "Support Ticket Volume" dashboard tile, which shows open vs. closed support tickets opened within the last ${days} days.`;

  // Point-in-time tiles are always as-of-now regardless of the range filter.
  const mrrContext = `The user is looking at the "Current MRR" dashboard tile, which shows total monthly recurring revenue right now (a point-in-time snapshot, not affected by any date range).`;
  const overdueRateContext = `The user is looking at the "Overdue Invoice Rate" dashboard tile, which shows the percentage of all invoices ever issued that are currently overdue (a point-in-time snapshot).`;
  const customerStatusContext = `The user is looking at the "Customers by Status" dashboard tile, which shows current active/churned/trial customer counts (a point-in-time snapshot).`;

  return (
    <MascotProvider>
      <AppShell>
        <div className="px-4 py-8 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Business Dashboard
              </h1>
              <div className="flex gap-2">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setDays(opt.days)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      days === opt.days
                        ? "border-[var(--accent)] text-[var(--accent-strong)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Point-in-time stats — always as-of-now, ignore the range filter (FR-D3).
                Hero treatment on the two headline figures, per the dataviz skill:
                "lead with big-number tiles only when those figures are the point
                of the page" — they are, for a founder glancing at this daily. */}
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
              <StatTileCard
                title="Current MRR"
                path="/dashboard/mrr"
                format={formatCurrency}
                askAiContext={mrrContext}
                hero
              />
              <StatTileCard
                title="Overdue Invoice Rate"
                path="/dashboard/overdue-rate"
                format={formatPercent}
                askAiContext={overdueRateContext}
                hero
              />
              <ChartTileCard
                title="Customers by Status"
                path="/dashboard/customer-status"
                chartType="bar"
                xKey="status"
                yKey="customer_count"
                askAiContext={customerStatusContext}
                colorForCategory={customerStatusColor}
              />
            </div>

            {/* Range-filterable tiles (FR-D3) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartTileCard
                title="Monthly Revenue Trend"
                path="/dashboard/revenue-trend"
                chartType="line"
                xKey="month"
                yKey="revenue"
                days={days}
                askAiContext={revenueTrendContext}
              />
              <ChartTileCard
                title="Signups by Month"
                path="/dashboard/signups-by-month"
                chartType="line"
                xKey="month"
                yKey="new_signups"
                days={days}
                askAiContext={signupsByMonthContext}
              />
              <ChartTileCard
                title="Signups by Country (Top 10)"
                path="/dashboard/signups-by-country"
                chartType="bar"
                xKey="country"
                yKey="customer_count"
                days={days}
                askAiContext={signupsByCountryContext}
              />
              <ChartTileCard
                title="Churn by Plan"
                path="/dashboard/churn-by-plan"
                chartType="bar"
                xKey="name"
                yKey="churned_count"
                days={days}
                askAiContext={churnByPlanContext}
              />
              <ChartTileCard
                title="Support Ticket Volume"
                path="/dashboard/ticket-volume"
                chartType="bar"
                xKey="status"
                yKey="ticket_count"
                days={days}
                askAiContext={ticketVolumeContext}
                colorForCategory={ticketStatusColor}
              />
            </div>
          </div>
        </div>
      </AppShell>

      <MascotPanel />
      <MascotToggleButton />
    </MascotProvider>
  );
}
