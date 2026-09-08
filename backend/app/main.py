"""FastAPI entrypoint for the AI Analytics Copilot backend.

Phase 0: health check only. Phase 1+ adds /ask (schema introspection,
NL->SQL, validation, execution, charting) per REQUIREMENTS.md.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Analytics Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
