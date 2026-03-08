"""CutAI — AI Film Director & Storyboard Engine. FastAPI entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from contextlib import asynccontextmanager

from config import ALLOWED_ORIGINS, GENERATED_FRAMES_DIR
from models.database import init_db


@asynccontextmanager
async def lifespan(app):
    await init_db()
    yield


app = FastAPI(
    title="CutAI",
    description="AI Film Director & Storyboard Engine",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure generated frames directory exists
os.makedirs(GENERATED_FRAMES_DIR, exist_ok=True)

# Serve generated images as static files
app.mount("/generated", StaticFiles(directory="generated"), name="generated")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "CutAI"}
