# docs/

Implementation-reference documentation for this project — written for whoever (human or agent) picks the build back up, to understand how the system is actually wired without re-reading every source file from scratch.

**Not the same as the root docs.** `SCOPE.md` / `REQUIREMENTS.md` / `BUILD_PLAN.md` at the repo root are the source of truth for *what* to build, *why it's scoped this way*, and *current build status* — read those first. This folder is about *how the current code actually works*.

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — start here. End-to-end request flow, project structure, why each major decision was made, the three-guardrail-layer summary.
- `modules/` — one doc per module, in build order:
  - [`database.md`](./modules/database.md) — Postgres, migrations, seed data
  - [`schema-introspection.md`](./modules/schema-introspection.md) — Phase 1: whitelist, introspection, schema context builder
  - [`nl-to-sql.md`](./modules/nl-to-sql.md) — Phase 2: the LLM call, retry logic, test question set
  - [`guardrails.md`](./modules/guardrails.md) — Phase 3: the three safety layers (most protected module)
  - [`visualization-explanation.md`](./modules/visualization-explanation.md) — Phase 4: chart heuristic, explanation generation
  - [`api.md`](./modules/api.md) — Phase 5 backend: the FastAPI `/ask` endpoint
  - [`frontend.md`](./modules/frontend.md) — Phase 5 frontend: the ask bar UI, chart components
  - [`dashboard.md`](./modules/dashboard.md) — v2 tickets D1-D2: fixed KPI tile queries + grid UI, still through the same restricted role
  - [`mascot-analyst.md`](./modules/mascot-analyst.md) — v2 tickets D3-D5: backend context-seeding, original frontend, guardrail re-verification
  - [`compass.md`](./modules/compass.md) — v3 tickets P1-P6 (+ post-launch polish): Compass rebrand + avatar, app shell, `/compass` chat UI, dashboard visual overhaul, landing page as the app's root

These docs describe the state of the code as of when they were written — if you make a structural change, update the relevant doc in the same pass, the way you'd update a comment. They will drift if not kept current; treat a stale doc as a bug.
