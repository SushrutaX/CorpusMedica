import os
import logging
from typing import Optional
from groq import Groq

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a medical AI assistant.

Rules:
- DO NOT provide a medical diagnosis
- DO NOT prescribe treatment
- Explain lab results clearly and cautiously
- Mention possible symptoms without alarming language
- Always include a disclaimer
"""


def get_groq_client() -> Optional[Groq]:
    """
    Lazily create a Groq client.
    Returns None if GROQ_API_KEY is not configured.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set. Groq explanations disabled.")
        return None
    return Groq(api_key=api_key)


def _call_model(client: Groq, model: str, messages: list) -> str:
    logger.info("Calling Groq model: %s", model)
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.3,
        max_tokens=500,
    )
    return response.choices[0].message.content


def explain_report_with_groq(extracted_values: dict, risk_analysis: dict) -> str:
    """
    Generate a medical explanation using Groq.
    Falls back gracefully if models are unavailable.
    """
    client = get_groq_client()
    if client is None:
        return "AI explanation is unavailable because GROQ_API_KEY is not configured."

    user_prompt = f"""
Lab values:
{extracted_values}

Risk analysis:
{risk_analysis}

Explain these findings in simple, non-alarming language.
"""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # ✅ ONLY USE VALID, CURRENT GROQ MODELS
    primary_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    fallback_model = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")

    candidates = [primary_model, fallback_model]

    last_error = None
    for model in candidates:
        try:
            return _call_model(client, model, messages)
        except Exception as e:
            last_error = e
            logger.exception("Groq call failed for model %s", model)

    # Graceful degradation (never break API response)
    return (
        "Unable to generate AI explanation at this time. "
        "The structured risk analysis above remains valid.\n\n"
        f"Last error: {str(last_error)}"
    )
