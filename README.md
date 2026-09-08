# AI Analytics Copilot

> Ask your database a question in plain English — get a safe SQL query, a chart, and a plain-English answer. No BI tool, no SQL required.

**Status:** early scaffolding (Phase 0 of `BUILD_PLAN.md`). This README is a placeholder — architecture diagram and "how the guardrails work" section land in Phase 6.

See `SCOPE.md`, `REQUIREMENTS.md`, and `BUILD_PLAN.md` for the full spec and phased build plan.

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
