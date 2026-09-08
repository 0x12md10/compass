"""Thin wrapper around the Gemini API for structured SQL generation.

Kept as the single place that knows which LLM provider is in use (see
REQUIREMENTS.md §1 note) — swapping providers later means changing this
module only, not the rest of the pipeline.
"""

import json
import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

_SQL_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "sql": {
            "type": "string",
            "description": "Exactly one SQL SELECT statement answering the question.",
        },
        "refusal_reason": {
            "type": "string",
            "description": (
                "Set ONLY if the question cannot be answered with a safe, "
                "read-only SELECT against the whitelisted schema (e.g. it asks "
                "for a mutation, or asks about something outside this schema). "
                "Leave empty otherwise."
            ),
        },
    },
    "required": ["sql", "refusal_reason"],
}


def _get_model(system_instruction: str) -> genai.GenerativeModel:
    api_key = os.environ["GEMINI_API_KEY"]
    genai.configure(api_key=api_key)
    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    return genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)


def generate_sql(system_instruction: str, user_prompt: str) -> dict:
    """Calls the LLM and returns {"sql": str, "refusal_reason": str}.

    Uses Gemini's JSON structured-output mode so the response is reliably
    parseable, never free text to regex out (REQUIREMENTS.md FR3).
    """
    model = _get_model(system_instruction)
    response = model.generate_content(
        user_prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=_SQL_RESPONSE_SCHEMA,
            max_output_tokens=4096,
            temperature=0,
        ),
    )
    return json.loads(response.text)
