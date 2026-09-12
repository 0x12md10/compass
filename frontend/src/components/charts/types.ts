export type ChartType = "stat" | "bar" | "line" | "table";

export interface ChartSpec {
  chart_type: ChartType;
  x_key?: string | null;
  y_key?: string | null;
}

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}
