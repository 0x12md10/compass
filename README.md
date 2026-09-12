# Compass

> A real business dashboard with a guardrailed AI analyst built in. Ask your database a question in plain English — get a safe SQL query, a chart, and a plain-English answer. No BI tool, no SQL required.

**Status:** in progress (see `BUILD_PLAN.md`'s status tracker for current phase). This README is a placeholder for the public-facing version — the real architecture diagram and "how the guardrails work" section land in Phase 6.

See `SCOPE.md`, `REQUIREMENTS.md`, and `BUILD_PLAN.md` for the full spec and phased build plan. For how the code is actually wired together, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the per-module docs in [`docs/modules/`](docs/modules/).

## The demo, in three parts

**1. Landing page** — the app's root (`/`), making the actual pitch: a real dashboard plus a guardrailed AI analyst, with an animated Compass in the hero.

**2. Business dashboard** — at `/dashboard`: a real KPI dashboard (MRR, overdue invoices, revenue trend, churn by plan, signups by country/month, support ticket volume), built entirely on this project's own chart components — not an embedded third-party BI tool (see `v2/SCOPE.md` §3 for why Metabase/Superset were evaluated and rejected). A persistent floating Compass widget is reachable from every page.

**3. Compass** — a guardrailed AI analyst, reachable two ways: the floating widget (`MascotToggleButton`/`MascotPanel`, one question → one answer) and a full-page, Claude-like running conversation at `/compass`. Both are thin UI layers over the same `/ask` pipeline the original ask bar used (still reachable directly at `/ask`, unlinked from the nav) — no second, weaker path to the database (see `docs/modules/compass.md`).

Type a plain-English question about the seeded SaaS company's data anywhere Compass appears; get back a chart, a 2-3 sentence explanation, and a "show generated SQL" toggle for transparency. Try an adversarial question ("delete all customers with overdue invoices") to see the guardrails visibly refuse it — that's the whole trust argument in one interaction, and it's identical no matter which entry point you ask from, all running through the same three-layer guardrail pipeline (prompt instruction → sqlglot AST validation → a database role that is physically incapable of mutating data) — see `docs/modules/guardrails.md` for how, and `docs/modules/mascot-analyst.md` / `docs/modules/compass.md` for how each entry point was proven exactly as safe as the original, not a shortcut around it.

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
