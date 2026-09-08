# SCOPE.md — AI Analytics Copilot (Portfolio Project)

## What this document is
Read this file first. It defines what this project is, who it's for, what it explicitly does NOT do, and when it's considered finished. `REQUIREMENTS.md` and `BUILD_PLAN.md` build on top of this — if anything in those files conflicts with the cut list below, this file wins.

---

## 1. One-line pitch
"Ask your database a question in plain English — get a safe SQL query, a chart, and a plain-English answer. No BI tool, no SQL required."

## 2. Why this project exists
This is a **portfolio piece**, not a real product. Its job is to prove — to a prospective freelance client — that Abishek can safely and correctly bolt an LLM feature onto an existing app/database. It is one of the "Portfolio Projects" required in the Freelance Side-Hustle System's Epic 1 / Sprint work, replacing the plain "RAG chatbot" idea with something more differentiated: a natural-language-to-SQL analytics copilot.

Because it's a portfolio piece and not a client engagement, **shipping a small, trustworthy, well-explained thing beats building a large, impressive-sounding, half-finished thing.** Every decision below is made in that direction.

## 3. Target persona (who the demo is written for)
A non-technical operator at a small SaaS company (founder, ops lead, customer success manager) who has a Postgres database behind their product, no in-house data analyst, and keeps asking an engineer "hey can you pull a number for me." The demo dataset simulates exactly this: a small SaaS company's customers/subscriptions/invoices/usage data.

## 4. Real-world problem this solves
Non-technical stakeholders can't write SQL and don't want to learn a BI tool's UI just to answer one question. Engineers get pulled into one-off data requests that interrupt real work. A "just ask" bar that safely queries the live schema removes that back-and-forth.

## 5. What's IN scope for v1 (ship this)
- One seeded demo Postgres database representing a small SaaS company (customers, subscriptions, plans, invoices, usage events — exact schema in `REQUIREMENTS.md`).
- A backend service that introspects that schema and uses it to ground an LLM's SQL generation (not hardcoded query templates — genuine schema-aware generation is the point of the demo).
- Natural language → SQL (SELECT-only) → safe execution → chart → plain-English explanation, in a single request/response turn.
- Multiple layers of guardrails preventing any mutating or unsafe query from ever reaching the database (detailed in `REQUIREMENTS.md` §Guardrails). This is a major part of the sales pitch, not an afterthought — the Loom demo should explicitly show an attempted "delete everything" prompt being blocked.
- A clean, simple web UI: ask bar, chart + explanation, a "show generated SQL" toggle for transparency.
- Public deployment, a documented GitHub repo, and a short demo video.

## 6. Cut list — explicitly OUT of scope for v1
Read this list before writing any code. If a task isn't in `BUILD_PLAN.md` and it's on this list, don't build it — flag it to Abishek instead of quietly adding it.

- **No multi-tenant support.** One demo dataset, one schema. Not "works with any customer's database."
- **No arbitrary schema upload.** The schema is known and fixed ahead of time. The engine must still work by *introspecting* it (not hardcoded queries) — that's what makes the demo credible — but there's no UI for a user to plug in their own database in v1.
- **No write queries, ever, under any circumstance.** Read-only is a hard constraint, not a soft preference. This is enforced at three independent layers (see Requirements §Guardrails), not just a prompt instruction.
- **No authentication / multi-user accounts / roles.** Single unauthenticated demo instance is fine. (Do not skip basic abuse protection — see rate limiting in Requirements — but that's not the same as user accounts.)
- **No support for schemas beyond the ~6 seeded tables.** Don't build a generic "handles any number of joins across any number of tables" engine. Bound the problem.
- **No multi-turn conversational memory in v1.** Each question is answered independently. ("Follow-up questions" is a stretch goal only — see Build Plan — and only attempted after everything else ships.)
- **No support for non-Postgres databases.**
- **No production concerns**: no caching layer, no horizontal scaling, no cost-optimization pass on LLM calls, no admin dashboard for query logs (a simple log file/table is enough).
- **No pixel-perfect design system.** Clean and usable beats beautiful. Time saved here goes into the guardrails and the demo dataset quality instead.

If mid-build it becomes tempting to add something from this list "since it's easy" — don't. Note it as a stretch idea in `BUILD_PLAN.md` and keep moving.

## 7. Definition of done (ship criteria)
This project is complete — and ready to go into the portfolio table — when ALL of the following are true:
1. Deployed and publicly reachable (frontend + backend), no local-only demo.
2. Seeded demo data is realistic enough that answers to the test question set (see `BUILD_PLAN.md` Phase 2) look like real business insight, not toy numbers.
3. The three-layer guardrail system is demonstrably working — an adversarial prompt attempting a destructive or off-schema query is visibly blocked in the UI.
4. GitHub repo is public, has a README with an architecture diagram and a "how the guardrails work" section (this section is what technical clients will actually read).
5. A 2–3 minute Loom exists showing: a normal question → answer, then an adversarial question → safe refusal, narrated in plain language a non-technical founder would understand.
6. One headline metric is written for the portfolio table, e.g. "Turns a plain-English question into a safe, schema-grounded chart in under 8 seconds — no SQL access required."

## 8. Priority order when something has to give
No fixed deadline is being enforced on this build — the decision is to do this one right rather than fast, since it's meant to carry real weight in front of clients before you go to market. That does not mean there's no prioritization; it means the prioritization is by *quality of the thing that matters most*, not by calendar day. If a tradeoff comes up anywhere in the build — polish vs. depth, breadth vs. rigor — resolve it in this order, most-protected first:

1. **Guardrail rigor (Phase 3) is the most protected thing in this entire project.** All three layers (prompt instruction, AST validation, DB-role permission) must be genuinely solid, tested against real adversarial attempts, and demonstrably redundant with each other. This is never the place to cut corners or ship "probably fine" — it's the entire trust argument the demo makes to a client, and a client evaluating you for real work will probe exactly this.
2. **NL → SQL engine correctness and breadth (Phase 2) comes second.** It's fine — expected, even — for this to take the most calendar time and iteration of any phase. Widen the test question set beyond the 15 baseline questions if it strengthens the demo; don't stop at "good enough."
3. **UI polish (Phase 5) is the most disposable of the three.** Clean and functional is sufficient. Time is better spent going back to strengthen #1 or #2 than making the frontend prettier. If ever forced to choose, simplify or delay UI polish before touching either of the above.

Put plainly: if you ever find yourself deciding between "make the chart look nicer" and "add one more adversarial-prompt test case to the guardrail suite," the guardrail test case wins, every time.

## 8a. Pace note
No hard deadline, but don't let "no deadline" quietly become "no forward motion" — that's the same trap the freelance system's own risk dashboard flags under "no client in 8 weeks." Use the phase status tracker in `BUILD_PLAN.md` as the pace signal instead of a date: if a phase sits at "In progress" for a long stretch with no status-note updates, that's worth a deliberate check-in on whether it's genuine depth work (fine, keep going per §8) or drift (worth naming).

## 9. A practical build note (read this before Phase 0)
The original idea referenced forking Metabase or Superset. That's the right *category* to point to when talking to clients ("the kind of thing Metabase/Superset can't do out of the box"), but actually forking either codebase would burn most of the 12-day timebox just learning an unfamiliar large codebase (Superset is a large Python/React monorepo; Metabase is Clojure). Building a small, standalone app that demonstrates the same pattern — natural language in, safe query + chart + explanation out, against a real Postgres schema — is more buildable in the timebox, and is actually closer to real freelance work anyway: clients almost never want you to fork their BI tool, they want the capability added next to their own app and their own database. Treat "inspired by the BI-copilot pattern, built standalone" as the approach, not "fork an existing OSS BI tool."
