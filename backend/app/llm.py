"""LLM provider wrapper — the single module that knows which LLM provider
is in use (see REQUIREMENTS.md §1 note). Swapping/adding a provider means
changing only this file, not the rest of the pipeline.

Provider is selected via LLM_PROVIDER ("groq" | "gemini"), defaulting to
"groq" — Groq's free tier has a much higher daily request cap than
Gemini's, which repeatedly blocked live testing during this build. Gemini
is kept as an alternate/fallback provider, not removed.
"""

import json
import os

from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "groq").lower()

_SQL_TOOL_PARAMETERS = {
    "type": "object",
    "properties": {
        "sql": {
            "type": "string",
            "description": "Exactly one SQL SELECT statement answering the question. Empty if refusing.",
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


# --- Groq -------------------------------------------------------------

def _groq_client():
    from groq import Groq

    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _groq_generate_sql(system_instruction: str, user_prompt: str) -> dict:
    client = _groq_client()
    model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "generate_sql",
                    "description": "Return the generated SQL statement, or a refusal reason.",
                    "parameters": _SQL_TOOL_PARAMETERS,
                },
            }
        ],
        tool_choice={"type": "function", "function": {"name": "generate_sql"}},
        temperature=0,
        max_tokens=4096,
        # gpt-oss-120b is a reasoning model — it spends tokens "thinking"
        # before the tool call. Low effort keeps that overhead small so it
        # doesn't compete with max_tokens the way default/high effort does.
        reasoning_effort="low",
    )

    tool_calls = response.choices[0].message.tool_calls
    if not tool_calls:
        # Model ignored the forced tool call — treat as a refusal rather than crash.
        return {"sql": "", "refusal_reason": "The model did not return a structured response."}
    return json.loads(tool_calls[0].function.arguments)


def _groq_generate_text(system_instruction: str, user_prompt: str, max_output_tokens: int) -> str:
    client = _groq_client()
    model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=max_output_tokens,
        reasoning_effort="low",
    )
    return response.choices[0].message.content.strip()


# --- Gemini -------------------------------------------------------------

def _gemini_model(system_instruction: str):
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    return genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)


def _gemini_generate_sql(system_instruction: str, user_prompt: str) -> dict:
    import google.generativeai as genai

    schema = {
        "type": "object",
        "properties": _SQL_TOOL_PARAMETERS["properties"],
        "required": _SQL_TOOL_PARAMETERS["required"],
    }
    model = _gemini_model(system_instruction)
    response = model.generate_content(
        user_prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=schema,
            max_output_tokens=4096,
            temperature=0,
        ),
    )
    return json.loads(response.text)


def _gemini_generate_text(system_instruction: str, user_prompt: str, max_output_tokens: int) -> str:
    import google.generativeai as genai

    model = _gemini_model(system_instruction)
    response = model.generate_content(
        user_prompt,
        generation_config=genai.GenerationConfig(
            max_output_tokens=max_output_tokens,
            temperature=0.3,
        ),
    )
    return response.text.strip()


# --- Public interface (provider-agnostic) --------------------------------

def generate_sql(system_instruction: str, user_prompt: str) -> dict:
    """Calls the LLM and returns {"sql": str, "refusal_reason": str}, via
    structured/tool-call output so the response is reliably parseable
    (REQUIREMENTS.md FR3), regardless of provider.
    """
    if LLM_PROVIDER == "groq":
        return _groq_generate_sql(system_instruction, user_prompt)
    return _gemini_generate_sql(system_instruction, user_prompt)


def generate_text(system_instruction: str, user_prompt: str, max_output_tokens: int = 300) -> str:
    """Plain-text LLM call (no structured output needed) — used for FR8's
    explanation generation.
    """
    if LLM_PROVIDER == "groq":
        return _groq_generate_text(system_instruction, user_prompt, max_output_tokens)
    return _gemini_generate_text(system_instruction, user_prompt, max_output_tokens)
