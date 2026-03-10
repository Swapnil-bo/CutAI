"""LLM client wrapper for CutAI.

Supports two providers:
- local: Ollama with qwen2.5:7b (forced JSON output)
- groq: Groq cloud API with llama-3.1-8b-instant
"""

import re
import json

from config import (
    LLM_PROVIDER,
    LLM_MODEL,
    LLM_NUM_CTX,
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
# Provider-specific chat implementations
# ---------------------------------------------------------------------------

def _chat_ollama(messages: list[dict], temperature: float | None = None) -> dict:
    """Send a chat request to Ollama and return parsed JSON."""
    import ollama

    response = ollama.chat(
        model=LLM_MODEL,
        messages=messages,
        format="json",
        options={
            "num_ctx": LLM_NUM_CTX,
            "temperature": temperature if temperature is not None else LLM_TEMPERATURE,
        },
    )
    raw_text = response["message"]["content"]
    return clean_json_response(raw_text)


def _chat_groq(messages: list[dict], temperature: float | None = None) -> dict:
    """Send a chat request to Groq cloud API and return parsed JSON."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=temperature if temperature is not None else LLM_TEMPERATURE,
        response_format={"type": "json_object"},
    )
    raw_text = response.choices[0].message.content
    return clean_json_response(raw_text)


# ---------------------------------------------------------------------------
# Public API — auto-dispatches based on LLM_PROVIDER
# ---------------------------------------------------------------------------

def chat(messages: list[dict], temperature: float | None = None) -> dict:
    """Send a chat request to the configured LLM provider and return parsed JSON.

    Args:
        messages: List of {"role": ..., "content": ...} dicts.
        temperature: Override default temperature if needed.

    Returns:
        Parsed dict from the LLM's JSON response.

    Raises:
        json.JSONDecodeError: If response cannot be parsed as JSON after cleaning.
    """
    if LLM_PROVIDER == "groq":
        return _chat_groq(messages, temperature)
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
                # Add a nudge to the messages for the retry
                messages = messages + [
                    {"role": "assistant", "content": "I apologize, let me fix the JSON."},
                    {"role": "user", "content": "Please respond with ONLY valid JSON. No markdown, no explanation."},
                ]
    raise ValueError(f"Failed to get valid JSON after {retries} attempts: {last_error}")
