# Module: Frontend Ask Bar UI (Phase 5, frontend half)

Files: `frontend/src/app/page.tsx`, `frontend/src/lib/api.ts`, `frontend/src/components/charts/*`

**Priority note**: per `SCOPE.md` §8, UI polish is the most disposable of the three protected priorities (guardrails > NL→SQL engine > UI). This module is built clean and functional, not deeply polished — if a future tradeoff comes up, this is what gives first.

## `lib/api.ts`

`askQuestion(question: string): Promise<AskResponse>` — the only fetch call in the app. Posts to `${NEXT_PUBLIC_API_BASE_URL}/ask` (defaults to `http://localhost:8000` if the env var isn't set — see `frontend/.env.local.example`). On a non-OK response, tries to extract FastAPI's `{detail: "..."}` body for a readable error message before falling back to a generic `Request failed (status)`.

The `AskResponse` TypeScript interface here must be kept manually in sync with the Pydantic `AskResponse` model in `backend/app/main.py` — no shared schema/codegen currently.

## `app/page.tsx` — the whole UI (single page, client component)

State: `question` (input value), `loading`, `error`, `history` (array of past `AskResponse` + a generated `id`, session-only — resets on reload, per FR11's "no persistence required").

Flow: submit → `askQuestion()` → on success, prepend to `history` and clear the input; on failure, set `error`. Both `loading` and `error` are cleared/set appropriately around the call.

Rendering, per history item:
- **If `refusal_reason` is set**: amber-bordered box with the message. Nothing else renders for that item — no chart, no SQL toggle (there isn't any SQL to show).
- **Otherwise**: explanation text (if present) → `ChartRenderer` (if columns/rows/chart_type are all present) → a collapsible `<details>` block with the raw SQL (FR9's "show generated SQL" transparency toggle — native HTML `<details>`, no JS state needed).

Other UI states:
- **Empty history + not loading**: shows a row of example-question chips (click to populate the input, per REQUIREMENTS's spirit of "no SQL required" — give a natural non-technical starting point).
- **Loading**: a spinner + "Thinking through your question..." message.
- **Fetch error** (network failure, backend down, unexpected non-`refusal_reason` failure): a distinct red error box, separate from the amber refusal box — these are different situations (guardrail-blocked question vs. actual system failure) and are deliberately styled differently so a viewer can tell them apart.

## `components/charts/`

| File | Responsibility |
|---|---|
| `types.ts` | `ChartSpec` and `QueryResult` — mirrors the backend's `chart_selector.ChartSpec` and the `(columns, rows)` shape. |
| `ChartRenderer.tsx` | Dispatches on `chart.chart_type`. Handles the empty-result case itself (shows "No results for this question" rather than an empty chart). |
| `StatTile.tsx` | Single big number + label, for `chart_type: "stat"`. |
| `BarChartView.tsx` / `LineChartView.tsx` | Recharts wrappers, single-series (see palette note below). |
| `DataTable.tsx` | Plain HTML table fallback, horizontally scrollable. |

### Color/design system

Built following the `dataviz` skill's method: form → color (last) → validated palette → mark specs → hover/tooltip → accessibility pass. Since every chart here is single-series (the chart heuristic only ever produces one metric per chart), only **categorical slot 1** from the skill's validated reference palette is used: `#2a78d6` (blue). No legend is needed for a single series (the skill's rule: legend required for ≥2 series, none for one).

Full chrome token set (light mode; dark mode uses this project's existing `dark:` Tailwind classes rather than the skill's exact CSS-variable contract, since this is a real Next.js app, not an Artifact):
- Chart surface `#fcfcfb` / dark `#1a1a19`
- Primary ink `#0b0b0b` / dark `#ffffff`
- Secondary ink `#52514e` / dark `#c3c2b7`
- Muted (axis labels) `#898781`
- Gridline `#e1e0d9` / dark `#2c2c2a`
- Baseline/axis `#c3c2b7` / dark `#383835`

Mark specs applied: 2px lines with 4px-radius dots on line charts, 4px-rounded bar tops, hover tooltips on both (Recharts' built-in `<Tooltip>`), `tabular-nums` on numeric table cells and the stat tile's big number.

### Known gap: never visually reviewed

The dataviz skill's step 7 ("render it and look at it") has **not** been done — this session has no screenshot/browser tool. What was verified instead: a clean TypeScript build (`tsc --noEmit` / `next build`), and a runtime smoke test (a temporary mock page rendered all 5 cases — stat/bar/line/table/empty — with `HTTP 200` and no runtime crash, then the temp page was deleted). The actual pixel-level appearance (spacing, label collisions, real Recharts SVG geometry) is unconfirmed. Do this before considering the frontend "done" — either via the `run` skill (can launch and screenshot the app) or a manual look once Docker/backend/frontend are all running together.

## Environment

`frontend/.env.local` (gitignored, not committed) sets `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` for local dev. `.env.local.example` documents this for anyone cloning fresh. In Phase 6 (deployment), this needs to point at the deployed backend URL instead — likely set via Vercel's environment variable settings, not a committed file.

## If you need to change something here

- **Add a new chart type**: add the component, extend `ChartRenderer.tsx`'s dispatch, and make sure `chart_selector.py` (backend) can actually produce that `chart_type` value.
- **Change the API base URL for a deployed environment**: set `NEXT_PUBLIC_API_BASE_URL` in the hosting platform's env config, not by editing `api.ts` directly.
- **Add persistence to question history**: currently deliberately session-only (FR11) — this is an explicit scope decision, not an oversight; check with Abishek before changing it, since REQUIREMENTS.md treats persistence as a non-requirement.
