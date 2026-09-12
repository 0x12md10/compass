# AI Analytics Copilot

> Ask your database a question in plain English — get a safe SQL query, a chart, and a plain-English answer. No BI tool, no SQL required.

**Status:** in progress (see `BUILD_PLAN.md`'s status tracker for current phase). This README is a placeholder for the public-facing version — the real architecture diagram and "how the guardrails work" section land in Phase 6.

See `SCOPE.md`, `REQUIREMENTS.md`, and `BUILD_PLAN.md` for the full spec and phased build plan. For how the code is actually wired together, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the per-module docs in [`docs/modules/`](docs/modules/).

## The demo, in four parts

**1. Business dashboard** — the app's home page (`/`): a real KPI dashboard (MRR, overdue invoices, revenue trend, churn by plan, signups by country/month, support ticket volume), built entirely on this project's own chart components — not an embedded third-party BI tool (see `v2/SCOPE.md` §3 for why Metabase/Superset were evaluated and rejected). Every tile has an **"Ask AI about this"** link into Compass, the AI analyst, already anchored to that specific chart.

**2. Compass** — a guardrailed AI analyst, reachable two ways: a persistent floating widget on every page (`MascotToggleButton`/`MascotPanel`, one question → one answer, anchored to whatever tile you clicked from), and a full-page, Claude-like running conversation at `/compass`. Both are thin UI layers over the exact same `/ask` pipeline as the classic ask bar — no second, weaker path to the database (see `docs/modules/compass.md`).

**3. Classic ask bar** — the original single-input experience, now at `/ask`. Type a plain-English question about the seeded SaaS company's data; get back a chart, a 2-3 sentence explanation, and a "show generated SQL" toggle for transparency. Try an adversarial question ("delete all customers with overdue invoices") to see the guardrails visibly refuse it — that's the whole trust argument in one interaction, and it's identical whichever of the three entry points you ask it from.

**4. Landing page** — a marketing page at `/landing` making the actual pitch above, with an animated Compass in the hero.

All three question-asking surfaces (dashboard widget, `/compass`, `/ask`) run through the identical three-layer guardrail pipeline (prompt instruction → sqlglot AST validation → a database role that is physically incapable of mutating data) — see `docs/modules/guardrails.md` for how, and `docs/modules/mascot-analyst.md` / `docs/modules/compass.md` for how each contextual entry point was proven to be exactly as safe as the plain ask bar, not a shortcut around it.

## Local development (Phase 0)

> Note: the demo Postgres container is mapped to host port `5434` (not the default `5432`) to avoid clashing with a locally installed Postgres service. Adjust if that port is also taken on your machine.

```bash
# 1. Start Postgres
docker-compose up -d

# 2. Seed demo data
cd backend
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
python ../db/seed.py

# 3. Run the backend
uvicorn app.main:app --reload

# 4. Run the frontend
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:3000` for the ask bar, or `http://localhost:3000/dashboard` for the business dashboard + AI analyst.
