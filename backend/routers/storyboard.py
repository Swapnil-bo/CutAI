"""Storyboard generation pipeline with SSE progress.

Pipeline order (VRAM-safe, RTX 3050 6GB):
1. Load LLM → generate/parse script → refine SD prompts per scene → unload LLM
2. Save all structured data to database
3. Load SD → generate ALL frames → unload SD
4. Update database with frame paths → return complete result
"""

import asyncio
import json
import traceback

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import async_session, get_session
from models.db_models import Project, Script as ScriptDB, Scene as SceneDB, Shot as ShotDB
from models.schemas import StoryboardGenerateRequest
from services.vram_manager import vram_manager
from services.script_parser import generate_script, parse_script_to_scenes
from services.scene_analyzer import generate_sd_prompts
from services.image_generator import load_sd_pipeline, unload_sd_pipeline, generate_frame

router = APIRouter(prefix="/api/storyboard", tags=["storyboard"])


def _sse(data: dict) -> str:
    """Format a dict as a Server-Sent Events data line."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("/generate")
async def generate_storyboard(request: StoryboardGenerateRequest):
    """Generate a full storyboard from script text or genre+premise.

    Returns a Server-Sent Events stream with real-time progress updates.
    Final event (type=complete) contains the project data.
    """
    return StreamingResponse(
        _run_pipeline(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_pipeline(request: StoryboardGenerateRequest):
    """Main generation pipeline. Yields SSE events as progress is made."""
    try:
        genre = request.genre or "drama"
        script_text = request.script_text

        # =================================================================
        # PHASE 1: LLM — all text generation (Qwen 2.5 7B via Ollama)
        # =================================================================
        await vram_manager.load_llm()

        # Step 1: Get or generate script text
        if script_text:
            yield _sse({
                "type": "progress", "stage": "script",
                "message": "Using provided script...", "progress": 5,
            })
        else:
            if not request.premise:
                yield _sse({
                    "type": "error",
                    "message": "Either script_text or genre + premise is required.",
                })
                return
            yield _sse({
                "type": "progress", "stage": "script",
                "message": "Generating script...", "progress": 5,
            })
            script_text = await asyncio.to_thread(
                generate_script, genre, request.premise, request.num_scenes,
            )
            yield _sse({
                "type": "progress", "stage": "script",
                "message": "Script generated!", "progress": 15,
            })

        # Step 2: Parse script into structured scenes
        yield _sse({
            "type": "progress", "stage": "parsing",
            "message": "Parsing script into scenes...", "progress": 20,
        })
        parsed = await asyncio.to_thread(
            parse_script_to_scenes, script_text, genre,
        )
        num_scenes = len(parsed.scenes)
        yield _sse({
            "type": "progress", "stage": "parsing",
            "message": f"Parsed {num_scenes} scenes", "progress": 30,
        })

        # Step 3: Refine SD prompts per scene (separate LLM call for quality)
        for i, scene in enumerate(parsed.scenes):
            progress = 30 + int(((i + 1) / num_scenes) * 20)
            yield _sse({
                "type": "progress", "stage": "analyzing",
                "message": f"Analyzing scene {i + 1}/{num_scenes}...",
                "progress": progress,
            })
            refined_shots = await asyncio.to_thread(generate_sd_prompts, scene.shots)
            parsed.scenes[i] = scene.model_copy(update={"shots": refined_shots})

        # Step 4: Unload LLM — done with all text generation
        yield _sse({
            "type": "progress", "stage": "transition",
            "message": "Preparing image generation...", "progress": 52,
        })
        await vram_manager.unload_llm()

        # =================================================================
        # PHASE 2: Save structured data to database
        # =================================================================
        # Capture IDs in local vars so they survive after session closes.
        project_id = None
        script_id = None
        # [(scene_db_id, [(sd_prompt, shot_number), ...]), ...]
        scene_shot_info: list[tuple[int, list[tuple[str, int]]]] = []

        async with async_session() as session:
            async with session.begin():
                project = Project(title=request.title, genre=genre)
                session.add(project)
                await session.flush()
                project_id = project.id

                script_rec = ScriptDB(
                    project_id=project_id,
                    title=parsed.title,
                    genre=parsed.genre,
                    logline=parsed.logline,
                    raw_text=script_text,
                    total_duration_seconds=parsed.total_duration_seconds,
                )
                session.add(script_rec)
                await session.flush()
                script_id = script_rec.id

                for scene_data in parsed.scenes:
                    scene_rec = SceneDB(
                        script_id=script_id,
                        scene_number=scene_data.scene_number,
                        title=scene_data.title,
                        location=scene_data.location,
                        time_of_day=scene_data.time_of_day,
                        description=scene_data.description,
                        characters=scene_data.characters,
                        mood_tension=scene_data.mood.tension,
                        mood_emotion=scene_data.mood.emotion,
                        mood_energy=scene_data.mood.energy,
                        mood_darkness=scene_data.mood.darkness,
                        mood_overall=scene_data.mood.overall_mood,
                        soundtrack_genre=scene_data.soundtrack.genre,
                        soundtrack_tempo=scene_data.soundtrack.tempo,
                        soundtrack_instruments=scene_data.soundtrack.instruments,
                        soundtrack_reference=scene_data.soundtrack.reference_track,
                        soundtrack_energy=scene_data.soundtrack.energy_level,
                    )
                    session.add(scene_rec)
                    await session.flush()

                    shot_info: list[tuple[str, int]] = []
                    for shot_data in scene_data.shots:
                        shot_rec = ShotDB(
                            scene_id=scene_rec.id,
                            shot_number=shot_data.shot_number,
                            shot_type=shot_data.shot_type,
                            camera_angle=shot_data.camera_angle,
                            camera_movement=shot_data.camera_movement,
                            description=shot_data.description,
                            dialogue=shot_data.dialogue,
                            duration_seconds=shot_data.duration_seconds,
                            sd_prompt=shot_data.sd_prompt,
                        )
                        session.add(shot_rec)
                        shot_info.append((shot_data.sd_prompt, shot_data.shot_number))

                    await session.flush()
                    scene_shot_info.append((scene_rec.id, shot_info))
            # Transaction committed on exit of session.begin()

        # =================================================================
        # PHASE 3: SD — generate ALL frames (SD 1.5 on CUDA, float16)
        # =================================================================
        total_frames = sum(len(shots) for _, shots in scene_shot_info)

        if total_frames > 0:
            yield _sse({
                "type": "progress", "stage": "loading_sd",
                "message": "Loading Stable Diffusion...", "progress": 55,
            })
            await load_sd_pipeline()

            frame_idx = 0
            # Track first frame per scene for the scene thumbnail
            scene_frame_paths: dict[int, str] = {}

            for scene_id, shots in scene_shot_info:
                for sd_prompt, shot_number in shots:
                    frame_idx += 1
                    progress = 55 + int((frame_idx / total_frames) * 40)
                    yield _sse({
                        "type": "progress", "stage": "generating_frames",
                        "message": f"Generating frame {frame_idx}/{total_frames}...",
                        "progress": progress,
                    })
                    path = await generate_frame(sd_prompt, scene_id, shot_number)
                    if scene_id not in scene_frame_paths:
                        scene_frame_paths[scene_id] = path

            yield _sse({
                "type": "progress", "stage": "unloading_sd",
                "message": "Cleaning up GPU memory...", "progress": 96,
            })
            await unload_sd_pipeline()

            # Update scene records with representative frame paths
            async with async_session() as session:
                async with session.begin():
                    for scene_id, frame_path in scene_frame_paths.items():
                        scene_rec = await session.get(SceneDB, scene_id)
                        if scene_rec:
                            scene_rec.frame_image_path = frame_path

        # =================================================================
        # PHASE 4: Complete
        # =================================================================
        yield _sse({
            "type": "complete",
            "message": "Storyboard generation complete!",
            "progress": 100,
            "data": {
                "project_id": project_id,
                "script_id": script_id,
                "title": parsed.title,
                "genre": parsed.genre,
                "logline": parsed.logline,
                "num_scenes": num_scenes,
                "total_frames": total_frames,
            },
        })

    except Exception as e:
        yield _sse({
            "type": "error",
            "message": str(e),
            "detail": traceback.format_exc(),
        })
        # Ensure VRAM cleanup on error — never leave models loaded
        try:
            await vram_manager.unload_llm()
        except Exception:
            pass
        try:
            await unload_sd_pipeline()
        except Exception:
            pass


# ===================================================================
# Export endpoint
# ===================================================================

@router.get("/{project_id}/export")
async def export_storyboard(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Return the complete storyboard as JSON for a project."""
    result = await session.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.scripts)
            .selectinload(ScriptDB.scenes)
            .selectinload(SceneDB.shots)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    return {
        "project": {
            "id": project.id,
            "title": project.title,
            "genre": project.genre,
            "created_at": project.created_at.isoformat() if project.created_at else "",
            "updated_at": project.updated_at.isoformat() if project.updated_at else "",
        },
        "scripts": [
            {
                "id": script.id,
                "title": script.title,
                "genre": script.genre,
                "logline": script.logline,
                "raw_text": script.raw_text,
                "total_duration_seconds": script.total_duration_seconds,
                "scenes": [
                    {
                        "id": scene.id,
                        "script_id": script.id,
                        "scene_number": scene.scene_number,
                        "title": scene.title,
                        "location": scene.location,
                        "time_of_day": scene.time_of_day,
                        "description": scene.description,
                        "characters": scene.characters or [],
                        "mood": {
                            "tension": scene.mood_tension,
                            "emotion": scene.mood_emotion,
                            "energy": scene.mood_energy,
                            "darkness": scene.mood_darkness,
                            "overall_mood": scene.mood_overall or "neutral",
                        },
                        "soundtrack": {
                            "genre": scene.soundtrack_genre or "",
                            "tempo": scene.soundtrack_tempo or "moderate",
                            "instruments": scene.soundtrack_instruments or [],
                            "reference_track": scene.soundtrack_reference or "",
                            "energy_level": scene.soundtrack_energy,
                        },
                        "frame_image_path": scene.frame_image_path,
                        "shots": [
                            {
                                "id": shot.id,
                                "shot_number": shot.shot_number,
                                "shot_type": shot.shot_type,
                                "camera_angle": shot.camera_angle,
                                "camera_movement": shot.camera_movement,
                                "description": shot.description,
                                "dialogue": shot.dialogue,
                                "duration_seconds": shot.duration_seconds,
                                "sd_prompt": shot.sd_prompt,
                            }
                            for shot in scene.shots
                        ],
                    }
                    for scene in script.scenes
                ],
            }
            for script in project.scripts
        ],
    }
