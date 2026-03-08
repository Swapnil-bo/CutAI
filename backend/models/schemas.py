"""Pydantic v2 schemas for CutAI data models."""

from pydantic import BaseModel


class Shot(BaseModel):
    shot_number: int
    shot_type: str          # "wide", "close-up", "medium", "over-the-shoulder", "POV", "aerial", "tracking"
    camera_angle: str       # "eye-level", "low-angle", "high-angle", "dutch-angle", "bird's-eye"
    camera_movement: str    # "static", "pan-left", "pan-right", "tilt-up", "tilt-down", "dolly-in", "dolly-out", "crane"
    description: str
    dialogue: str | None = None
    duration_seconds: int
    sd_prompt: str


class MoodScore(BaseModel):
    tension: float          # 0.0 - 1.0
    emotion: float          # 0.0 (sad) - 1.0 (joyful)
    energy: float           # 0.0 (calm) - 1.0 (intense)
    darkness: float         # 0.0 (light) - 1.0 (dark)
    overall_mood: str       # "melancholic", "thrilling", "romantic", "eerie", "triumphant", etc.


class SoundtrackVibe(BaseModel):
    genre: str              # "ambient electronic", "orchestral", "lo-fi", "jazz", "synthwave", etc.
    tempo: str              # "slow", "moderate", "fast"
    instruments: list[str]  # ["piano", "strings", "synth pad", "drums"]
    reference_track: str    # "Similar to: Hans Zimmer - Time"
    energy_level: float     # 0.0 - 1.0


class Scene(BaseModel):
    scene_number: int
    title: str
    location: str           # "INT. COFFEE SHOP - NIGHT"
    time_of_day: str        # "dawn", "morning", "afternoon", "evening", "night"
    description: str
    characters: list[str]
    shots: list[Shot]
    mood: MoodScore
    soundtrack: SoundtrackVibe
    frame_image_path: str | None = None


class Script(BaseModel):
    title: str
    genre: str
    logline: str
    scenes: list[Scene]
    total_duration_seconds: int


# --- Request / Response helpers ---

class ProjectCreate(BaseModel):
    title: str
    genre: str | None = None


class ProjectResponse(BaseModel):
    id: int
    title: str
    genre: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ScriptCreate(BaseModel):
    title: str
    genre: str | None = None
    logline: str | None = None
    raw_text: str | None = None


class GenerateRequest(BaseModel):
    genre: str
    premise: str
    num_scenes: int = 5
