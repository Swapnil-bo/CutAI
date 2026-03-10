"""Scene analysis service — shots, mood scoring, soundtrack vibes, SD prompts.

Each function makes a separate, focused LLM call to Qwen 2.5 7B via Ollama.
All outputs are validated against Pydantic schemas before returning.
"""

from config import IMAGE_PROVIDER
from models.schemas import Shot, MoodScore, SoundtrackVibe
from services.llm_client import chat_with_retry


# ---------------------------------------------------------------------------
# System prompts — one per function for focused, high-quality output
# ---------------------------------------------------------------------------

SHOT_ANALYSIS_PROMPT = """\
You are CutAI, an expert cinematographer. Given a scene description, break it \
down into a professional shot-by-shot plan.

Think like a real director:
- Vary shot types to create visual rhythm (wide → medium → close-up, etc.)
- Choose camera angles that serve the story's emotion
- Pick camera movements that enhance the narrative tension
- Write a vivid visual description for each shot
- Include any dialogue that occurs during the shot

shot_type must be one of: wide, close-up, medium, over-the-shoulder, POV, aerial, tracking
camera_angle must be one of: eye-level, low-angle, high-angle, dutch-angle, bird's-eye
camera_movement must be one of: static, pan-left, pan-right, tilt-up, tilt-down, dolly-in, dolly-out, crane

Respond ONLY with valid JSON. No markdown, no explanation."""

MOOD_SCORING_PROMPT = """\
You are CutAI, an expert film analyst. Given a scene description, score its \
mood on four dimensions. Think about the emotional undercurrent of the scene.

Return a JSON object with:
- tension: float 0.0 (relaxed) to 1.0 (maximum tension)
- emotion: float 0.0 (deeply sad) to 1.0 (joyful)
- energy: float 0.0 (calm/still) to 1.0 (intense/chaotic)
- darkness: float 0.0 (bright/lighthearted) to 1.0 (dark/grim)
- overall_mood: a single word or short phrase (e.g. "melancholic", "thrilling", \
"romantic", "eerie", "triumphant", "bittersweet", "ominous")

Respond ONLY with valid JSON. No markdown, no explanation."""

SOUNDTRACK_PROMPT = """\
You are CutAI, an expert film music supervisor. Given a scene description and \
its mood profile, suggest a soundtrack vibe that enhances the atmosphere.

Return a JSON object with:
- genre: music genre (e.g. "ambient electronic", "orchestral", "lo-fi", "jazz", \
"synthwave", "post-rock", "classical piano")
- tempo: "slow", "moderate", or "fast"
- instruments: array of key instruments (e.g. ["piano", "strings", "synth pad"])
- reference_track: a real reference in the form "Similar to: Artist - Track"
- energy_level: float 0.0 (quiet/ambient) to 1.0 (driving/powerful)

Respond ONLY with valid JSON. No markdown, no explanation."""

SD_PROMPT_SD15 = """\
You are CutAI, an expert at writing image generation prompts optimized for \
Stable Diffusion 1.5 (512x512).

Given a list of shot descriptions, rewrite each shot's sd_prompt to be a \
highly detailed visual prompt. Include:
- Art style and medium (cinematic, film grain, 35mm photography, digital art)
- Lighting (dramatic shadows, golden hour, neon glow, soft diffused light)
- Color palette (warm amber tones, cold blue steel, muted pastels)
- Composition cues (rule of thirds, centered, leading lines)
- Atmosphere (smoke haze, rain, dust particles, fog)

Use keyword-style prompts with quality boosters: "cinematic, 8k, masterpiece, \
trending on artstation, highly detailed, photorealistic".

Do NOT include character names — describe their appearance instead.
Keep each prompt under 120 words for best SD 1.5 results.

Return a JSON object: {"prompts": ["prompt1", "prompt2", ...]}
Order must match the input shot order.

Respond ONLY with valid JSON. No markdown, no explanation."""

SD_PROMPT_SDXL = """\
You are CutAI, an expert at writing image generation prompts optimized for \
SDXL (1024x1024).

Given a list of shot descriptions, rewrite each shot's sd_prompt to be a \
detailed natural language description of the image to generate. Write in \
flowing, descriptive sentences — NOT keyword lists.

Describe in natural language:
- What is happening in the scene and who is visible
- The environment, setting, and time of day
- Lighting quality and color mood
- Camera perspective and framing
- Artistic style (e.g. "a cinematic still from a neo-noir thriller")

Do NOT include character names — describe their appearance instead.
Keep each prompt 1-3 sentences.

Return a JSON object: {"prompts": ["prompt1", "prompt2", ...]}
Order must match the input shot order.

Respond ONLY with valid JSON. No markdown, no explanation."""


def _get_sd_prompt_system() -> str:
    """Return the appropriate SD prompt system prompt based on IMAGE_PROVIDER."""
    if IMAGE_PROVIDER == "replicate":
        return SD_PROMPT_SDXL
    return SD_PROMPT_SD15


# ---------------------------------------------------------------------------
# Public API — each function = one focused LLM call
# ---------------------------------------------------------------------------

def analyze_shots(
    scene_description: str,
    location: str,
    time_of_day: str,
    characters: list[str],
) -> list[Shot]:
    """Generate a professional shot-by-shot breakdown for a scene.

    Returns a list of validated Shot objects with camera angles, movements,
    descriptions, and placeholder SD prompts.
    """
    messages = [
        {"role": "system", "content": SHOT_ANALYSIS_PROMPT},
        {
            "role": "user",
            "content": (
                f"Break this scene into detailed shots (aim for 3-5 shots).\n\n"
                f"LOCATION: {location}\n"
                f"TIME OF DAY: {time_of_day}\n"
                f"CHARACTERS: {', '.join(characters) if characters else 'None'}\n\n"
                f"SCENE DESCRIPTION:\n{scene_description}\n\n"
                f"Return a JSON object: {{\"shots\": [...]}}\n"
                f"Each shot must have: shot_number (starting at 1), shot_type, "
                f"camera_angle, camera_movement, description, dialogue (string or null), "
                f"duration_seconds (integer), sd_prompt (detailed visual prompt for SD 1.5)."
            ),
        },
    ]
    result = chat_with_retry(messages, retries=3)
    raw_shots = result.get("shots", result if isinstance(result, list) else [result])
    if isinstance(raw_shots, dict):
        raw_shots = [raw_shots]
    return [Shot(**s) for s in raw_shots]


def score_mood(
    scene_description: str,
    location: str,
    time_of_day: str,
) -> MoodScore:
    """Score a scene's mood across tension, emotion, energy, and darkness."""
    messages = [
        {"role": "system", "content": MOOD_SCORING_PROMPT},
        {
            "role": "user",
            "content": (
                f"Score the mood of this scene.\n\n"
                f"LOCATION: {location}\n"
                f"TIME OF DAY: {time_of_day}\n\n"
                f"SCENE DESCRIPTION:\n{scene_description}"
            ),
        },
    ]
    result = chat_with_retry(messages, retries=3)
    return MoodScore(**result)


def suggest_soundtrack(
    scene_description: str,
    mood: MoodScore,
) -> SoundtrackVibe:
    """Suggest a soundtrack vibe for a scene given its description and mood."""
    messages = [
        {"role": "system", "content": SOUNDTRACK_PROMPT},
        {
            "role": "user",
            "content": (
                f"Suggest a soundtrack vibe for this scene.\n\n"
                f"SCENE DESCRIPTION:\n{scene_description}\n\n"
                f"MOOD PROFILE:\n"
                f"- Tension: {mood.tension}\n"
                f"- Emotion: {mood.emotion} (0=sad, 1=joyful)\n"
                f"- Energy: {mood.energy}\n"
                f"- Darkness: {mood.darkness}\n"
                f"- Overall mood: {mood.overall_mood}"
            ),
        },
    ]
    result = chat_with_retry(messages, retries=3)
    return SoundtrackVibe(**result)


def generate_sd_prompts(shots: list[Shot]) -> list[Shot]:
    """Optimize SD prompts for a list of shots.

    Takes existing shots (which may have basic sd_prompt fields) and rewrites
    their prompts to be highly detailed, SD 1.5-optimized visual descriptions.

    Returns new Shot objects with updated sd_prompt fields.
    """
    shot_descriptions = [
        {
            "shot_number": s.shot_number,
            "shot_type": s.shot_type,
            "camera_angle": s.camera_angle,
            "description": s.description,
            "current_sd_prompt": s.sd_prompt,
        }
        for s in shots
    ]

    messages = [
        {"role": "system", "content": _get_sd_prompt_system()},
        {
            "role": "user",
            "content": (
                f"Rewrite and optimize the SD prompts for these {len(shots)} shots.\n\n"
                f"SHOTS:\n{_format_shots_for_prompt(shot_descriptions)}\n\n"
                f"Return: {{\"prompts\": [\"prompt1\", \"prompt2\", ...]}}\n"
                f"You must return exactly {len(shots)} prompts in the same order."
            ),
        },
    ]
    result = chat_with_retry(messages, retries=3)
    prompts = result.get("prompts", [])

    # Rebuild shots with optimized prompts, falling back to originals
    updated_shots = []
    for i, shot in enumerate(shots):
        new_prompt = prompts[i] if i < len(prompts) else shot.sd_prompt
        updated_shots.append(shot.model_copy(update={"sd_prompt": new_prompt}))
    return updated_shots


def analyze_scene_full(
    scene_description: str,
    location: str,
    time_of_day: str,
    characters: list[str],
) -> dict:
    """Run the full analysis pipeline for a single scene.

    Calls analyze_shots, score_mood, suggest_soundtrack, and generate_sd_prompts
    sequentially (all use the same LLM, one call at a time).

    Returns a dict with keys: shots, mood, soundtrack.
    """
    shots = analyze_shots(scene_description, location, time_of_day, characters)
    mood = score_mood(scene_description, location, time_of_day)
    soundtrack = suggest_soundtrack(scene_description, mood)
    shots = generate_sd_prompts(shots)
    return {"shots": shots, "mood": mood, "soundtrack": soundtrack}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _format_shots_for_prompt(shot_descriptions: list[dict]) -> str:
    """Format shot descriptions as numbered text for the LLM prompt."""
    lines = []
    for s in shot_descriptions:
        lines.append(
            f"Shot {s['shot_number']} ({s['shot_type']}, {s['camera_angle']}): "
            f"{s['description']}\n  Current SD prompt: {s['current_sd_prompt']}"
        )
    return "\n".join(lines)
