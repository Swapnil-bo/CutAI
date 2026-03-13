"""LLM client wrapper for CutAI.

Cloud-only mode: Groq API with llama-3.1-8b-instant.
Local Ollama support disabled for PSU safety.
"""

import re
import json

from config import (
    LLM_PROVIDER,
    LLM_TEMPERATURE,
    GROQ_API_KEY,
    GROQ_MODEL,
)


def clean_json_response(text: str) -> dict:
    """Strip markdown fences, preamble, trailing text, and fix common issues."""
    # Remove markdown code fences
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    # Extract JSON object/array (first { to last } or first [ to last ])
    match = re.search(r'[\{\[]', text)
    if match:
        start = match.start()
        if text[start] == '{':
            end = text.rfind('}') + 1
        else:
            end = text.rfind(']') + 1
        text = text[start:end]
    # Fix trailing commas (common LLM mistake)
    text = re.sub(r',\s*([}\]])', r'\1', text)
    return json.loads(text)


# ---------------------------------------------------------------------------
# Local Ollama — DISABLED (PSU safety)
# ---------------------------------------------------------------------------
# All ollama imports and _chat_ollama() removed.
# If you need local LLM, set LLM_PROVIDER=local and re-enable,
# but this will load the GPU and risk PSU power spikes.

def _chat_ollama(messages: list[dict], temperature: float | None = None) -> dict:
    """Disabled — local LLM not available in cloud-only mode."""
    raise RuntimeError(
        "Local LLM disabled — use Groq. Set LLM_PROVIDER=groq in your environment."
    )


# ---------------------------------------------------------------------------
# Groq cloud API
# ---------------------------------------------------------------------------

def _chat_groq(messages: list[dict], temperature: float | None = None, json_mode: bool = True) -> str:
    """Send a chat request to Groq cloud API and return raw text.

    Args:
        json_mode: If True, forces JSON response format. If False, returns
                   free-form text (useful for screenplay generation).
    """
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    kwargs = dict(
        model=GROQ_MODEL,
        messages=messages,
        temperature=temperature if temperature is not None else LLM_TEMPERATURE,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Public API — auto-dispatches based on LLM_PROVIDER
# ---------------------------------------------------------------------------

def chat(messages: list[dict], temperature: float | None = None) -> dict:
    """Send a chat request to the configured LLM provider and return parsed JSON.

    Forces JSON response format on Groq. For free-form text, use chat_text().

    Returns:
        Parsed dict from the LLM's JSON response.
    """
    if LLM_PROVIDER == "groq":
        raw = _chat_groq(messages, temperature, json_mode=True)
        return clean_json_response(raw)
    return _chat_ollama(messages, temperature)


def chat_text(messages: list[dict], temperature: float | None = None) -> str:
    """Send a chat request and return raw text (no JSON constraint).

    Use this for creative generation (e.g. screenplay writing) where forcing
    JSON mode causes the LLM to reject the request or produce bad output.
    """
    if LLM_PROVIDER == "groq":
        return _chat_groq(messages, temperature, json_mode=False)
    # Local provider disabled
    return _chat_ollama(messages, temperature)


def chat_with_retry(messages: list[dict], retries: int = 3, temperature: float | None = None) -> dict:
    """Call chat() with retry logic for malformed JSON responses."""
    last_error = None
    for attempt in range(retries):
        try:
            return chat(messages, temperature=temperature)
        except (json.JSONDecodeError, KeyError) as e:
            last_error = e
            if attempt < retries - 1:
                messages = messages + [
                    {"role": "assistant", "content": "I apologize, let me fix the JSON."},
                    {"role": "user", "content": "Please respond with ONLY valid JSON. No markdown, no explanation."},
                ]
    raise ValueError(f"Failed to get valid JSON after {retries} attempts: {last_error}")


def chat_text_with_retry(messages: list[dict], retries: int = 3, temperature: float | None = None) -> str:
    """Call chat_text() with retry logic. Returns raw text string."""
    last_error = None
    for attempt in range(retries):
        try:
            result = chat_text(messages, temperature=temperature)
            if result and result.strip():
                return result
            raise ValueError("Empty response from LLM")
        except Exception as e:
            last_error = e
            if attempt < retries - 1:
                messages = messages + [
                    {"role": "user", "content": "Please try again."},
                ]
    raise ValueError(f"Failed to get text response after {retries} attempts: {last_error}")
