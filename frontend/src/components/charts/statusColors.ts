/** Fixed status palette (dataviz skill, never themed) — used only where a
 * chart category IS a status, never as a general categorical scheme.
 * Always paired with a visible text label (the bar's x-axis category name);
 * color is never the sole carrier of meaning here. */
const STATUS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
} as const;

export function customerStatusColor(status: string): string {
  switch (status) {
    case "active":
      return STATUS.good;
    case "churned":
      return STATUS.critical;
    case "trial":
      return STATUS.warning;
    default:
      return "var(--chart-series-1)";
  }
}

export function ticketStatusColor(status: string): string {
  switch (status) {
    case "closed":
      return STATUS.good;
    case "open":
      return STATUS.warning;
    default:
      return "var(--chart-series-1)";
  }
}
