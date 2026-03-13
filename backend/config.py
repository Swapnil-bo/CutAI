"""CutAI configuration settings.

Supports local (Ollama + SD 1.5) and production (Groq + Replicate) providers
via environment variables.
"""

from dotenv import load_dotenv
load_dotenv()

import os

# Server
HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", "8000"))

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cutai.db")

# Provider switches
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")          # "groq" only — local disabled for PSU safety
IMAGE_PROVIDER = os.getenv("IMAGE_PROVIDER", "replicate") # "replicate" only — local disabled for PSU safety

# Ollama / LLM (local)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:3b")
LLM_NUM_CTX = int(os.getenv("LLM_NUM_CTX", "4096"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))

# Groq (production LLM)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# Stable Diffusion (local)
SD_MODEL_ID = "runwayml/stable-diffusion-v1-5"
SD_WIDTH = 512
SD_HEIGHT = 512
SD_INFERENCE_STEPS = 25
SD_GUIDANCE_SCALE = 7.5
SD_NEGATIVE_PROMPT = "blurry, low quality, distorted, deformed, text, watermark"

# Replicate (production image gen)
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
REPLICATE_SDXL_MODEL = os.getenv(
    "REPLICATE_SDXL_MODEL",
    "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
)

# Paths
GENERATED_FRAMES_DIR = "generated/frames"

# CORS — localhost for dev, add production domains via env
_extra_origins = os.getenv("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
if _extra_origins:
    ALLOWED_ORIGINS.extend(
        origin.strip() for origin in _extra_origins.split(",") if origin.strip()
    )
