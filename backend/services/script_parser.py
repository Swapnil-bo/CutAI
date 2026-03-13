"""Script generation and parsing service.

Two-step pipeline:
  Step 1 — generate_script(): Free-form screenplay text (NO JSON constraint)
  Step 2 — parse_script_to_scenes(): LLM converts text → structured JSON (JSON mode)
"""

import json

from services.llm_client import chat_with_retry, chat_text_with_retry
from models.schemas import Script

# --- System prompts ---

SCRIPT_GENERATION_PROMPT = """You are CutAI, a creative screenwriter AI. Generate short, compelling scripts (3-7 scenes) based on the user's genre/premise.

Write in standard screenplay format. Each scene should have:
- A clear slug line (INT/EXT. LOCATION - TIME)
- Action descriptions
- Character dialogue (if any)
- Visual moments that translate well to storyboard frames

Keep scripts under 2 pages. Focus on visual storytelling over heavy dialogue.
Write the screenplay text directly. Do NOT wrap it in JSON."""

SCRIPT_PARSING_PROMPT = """You are CutAI, an expert film director and cinematographer AI. You analyze scripts and break them into detailed, filmable scenes with professional shot-by-shot breakdowns.

You MUST respond ONLY in valid JSON matching the provided schema. No markdown, no explanation, no preamble. Just pure JSON.

For each scene, think like a real director:
- Choose camera angles that serve the story's emotion
- Vary shot types to create visual rhythm
- Match mood scores to the narrative tension
- Suggest soundtrack vibes that enhance the atmosphere

For SD prompts: Write them as detailed visual descriptions optimized for Stable Diffusion 1.5. Include art style, lighting, color palette, composition. Example: "cinematic wide shot, dimly lit jazz bar, warm amber lighting, smoke haze, 1940s noir aesthetic, film grain, 35mm photography"
"""

# --- JSON schema description for the LLM ---

SCRIPT_SCHEMA_DESCRIPTION = """{
  "title": "string",
  "genre": "string",
  "logline": "string (one-sentence summary)",
  "total_duration_seconds": integer,
  "scenes": [
    {
      "scene_number": integer,
      "title": "string",
      "location": "string (e.g. INT. COFFEE SHOP - NIGHT)",
      "time_of_day": "dawn|morning|afternoon|evening|night",
      "description": "string (full scene description)",
      "characters": ["string"],
      "shots": [
        {
          "shot_number": integer,
          "shot_type": "wide|close-up|medium|over-the-shoulder|POV|aerial|tracking",
          "camera_angle": "eye-level|low-angle|high-angle|dutch-angle|bird's-eye",
          "camera_movement": "static|pan-left|pan-right|tilt-up|tilt-down|dolly-in|dolly-out|crane",
          "description": "string (what the shot shows)",
          "dialogue": "string or null",
          "duration_seconds": integer,
          "sd_prompt": "string (detailed visual prompt for Stable Diffusion 1.5, include art style, lighting, color palette)"
        }
      ],
      "mood": {
        "tension": float (0.0-1.0),
        "emotion": float (0.0 sad - 1.0 joyful),
        "energy": float (0.0 calm - 1.0 intense),
        "darkness": float (0.0 light - 1.0 dark),
        "overall_mood": "string (melancholic|thrilling|romantic|eerie|triumphant|etc)"
      },
      "soundtrack": {
        "genre": "string (ambient electronic|orchestral|lo-fi|jazz|synthwave|etc)",
        "tempo": "slow|moderate|fast",
        "instruments": ["string"],
        "reference_track": "string (Similar to: Artist - Track)",
        "energy_level": float (0.0-1.0)
      },
      "frame_image_path": null
    }
  ]
}"""


def generate_script(genre: str, premise: str, num_scenes: int = 5) -> str:
    """Generate a raw screenplay from genre and premise via LLM.

    Step 1 of the two-step pipeline. Uses free-form text mode (no JSON
    constraint) so the LLM can write natural screenplay text.

    Returns:
        Raw screenplay text as a string.
    """
    messages = [
        {"role": "system", "content": SCRIPT_GENERATION_PROMPT},
        {
            "role": "user",
            "content": (
                f"Write a {genre} script with {num_scenes} scenes based on this premise:\n\n"
                f"{premise}\n\n"
                f"Write the full screenplay text with proper slug lines, action, and dialogue."
            ),
        },
    ]
    return chat_text_with_retry(messages, retries=3)


def parse_script_to_scenes(script_text: str, genre: str = "drama") -> Script:
    """Parse raw script text into a fully structured Script with scenes, shots, mood, and soundtrack.

    Uses the LLM to analyze the script and produce structured output matching
    the Script Pydantic schema exactly.

    Args:
        script_text: The raw screenplay text to parse.
        genre: Genre hint for the LLM.

    Returns:
        A validated Script Pydantic model.
    """
    messages = [
        {"role": "system", "content": SCRIPT_PARSING_PROMPT},
        {
            "role": "user",
            "content": (
                f"Analyze this {genre} script and break it into detailed scenes with shot-by-shot breakdowns.\n\n"
                f"SCRIPT:\n{script_text}\n\n"
                f"Respond with a single JSON object matching this EXACT schema:\n{SCRIPT_SCHEMA_DESCRIPTION}\n\n"
                f"Requirements:\n"
                f"- Each scene MUST have at least 2 shots\n"
                f"- Each shot MUST have an sd_prompt optimized for Stable Diffusion 1.5\n"
                f"- All mood scores MUST be floats between 0.0 and 1.0\n"
                f"- All fields are required, dialogue can be null\n"
                f"- frame_image_path should be null"
            ),
        },
    ]
    result = chat_with_retry(messages, retries=3)
    return Script(**result)


def generate_and_parse(genre: str, premise: str, num_scenes: int = 5) -> Script:
    """Full pipeline: generate a script from premise, then parse into structured scenes."""
    script_text = generate_script(genre, premise, num_scenes)
    return parse_script_to_scenes(script_text, genre)
