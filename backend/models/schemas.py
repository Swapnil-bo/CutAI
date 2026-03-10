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


class StoryboardGenerateRequest(BaseModel):
    """Request for full storyboard generation.

    Provide either script_text (parse existing) or genre + premise (AI generate).
    """
    script_text: str | None = None
    genre: str | None = None
    premise: str | None = None
    num_scenes: int = 5
    title: str = "Untitled Project"


class ScriptUpdate(BaseModel):
    title: str | None = None
    genre: str | None = None
    logline: str | None = None
    raw_text: str | None = None


class SceneUpdate(BaseModel):
    title: str | None = None
    location: str | None = None
    time_of_day: str | None = None
    description: str | None = None
    characters: list[str] | None = None


class SceneReorder(BaseModel):
    """List of scene IDs in the desired order."""
    scene_ids: list[int]


class SceneCreate(BaseModel):
    """Create a new blank scene."""
    title: str = "New Scene"
    location: str | None = None
    time_of_day: str | None = None
    description: str | None = None


class RegenerateFrameRequest(BaseModel):
    """Request to regenerate a shot frame with an optional custom prompt."""
    sd_prompt: str | None = None


class ShotPromptUpdate(BaseModel):
    """Update the SD prompt for a shot."""
    sd_prompt: str


# --- Full response models for export ---

class ShotResponse(BaseModel):
    id: int
    shot_number: int
    shot_type: str
    camera_angle: str
    camera_movement: str
    description: str | None
    dialogue: str | None
    duration_seconds: int
    sd_prompt: str | None

    class Config:
        from_attributes = True


class SceneResponse(BaseModel):
    id: int
    scene_number: int
    title: str
    location: str | None
    time_of_day: str | None
    description: str | None
    characters: list
    mood: MoodScore | None = None
    soundtrack: SoundtrackVibe | None = None
    frame_image_path: str | None
    shots: list[ShotResponse] = []

    class Config:
        from_attributes = True


class ScriptResponse(BaseModel):
    id: int
    title: str
    genre: str | None
    logline: str | None
    raw_text: str | None
    total_duration_seconds: int
    created_at: str
    scenes: list[SceneResponse] = []

    class Config:
        from_attributes = True


class ProjectDetailResponse(BaseModel):
    id: int
    title: str
    genre: str | None
    created_at: str
    updated_at: str
    scripts: list[ScriptResponse] = []

    class Config:
        from_attributes = True
