"""CRUD routes for scenes — get, update, reorder, edit details, add, regenerate."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import get_session
from models.db_models import Scene, Shot
from models.schemas import SceneUpdate, SceneReorder, SceneCreate, ShotPromptUpdate

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


@router.get("/script/{script_id}")
async def list_scenes_for_script(
    script_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get all scenes for a script, ordered by scene_number, with shots."""
    result = await session.execute(
        select(Scene)
        .where(Scene.script_id == script_id)
        .options(selectinload(Scene.shots))
        .order_by(Scene.scene_number)
    )
    scenes = result.scalars().all()
    return [_scene_to_response(sc) for sc in scenes]


@router.get("/{scene_id}")
async def get_scene(
    scene_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single scene with its shots."""
    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene_id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(404, "Scene not found")
    return _scene_to_response(scene)


@router.put("/{scene_id}")
async def update_scene(
    scene_id: int,
    body: SceneUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Edit scene details (title, location, time_of_day, description, characters)."""
    scene = await session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(scene, field, value)
    await session.commit()
    await session.refresh(scene)
    # Re-fetch with shots loaded
    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene_id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one()
    return _scene_to_response(scene)


@router.put("/reorder/{script_id}")
async def reorder_scenes(
    script_id: int,
    body: SceneReorder,
    session: AsyncSession = Depends(get_session),
):
    """Update scene order. Accepts a list of scene IDs in the desired order."""
    result = await session.execute(
        select(Scene).where(Scene.script_id == script_id)
    )
    scenes = {s.id: s for s in result.scalars().all()}

    for new_number, scene_id in enumerate(body.scene_ids, start=1):
        if scene_id not in scenes:
            raise HTTPException(400, f"Scene {scene_id} not found in script {script_id}")
        scenes[scene_id].scene_number = new_number

    await session.commit()
    return {"message": "Scenes reordered", "order": body.scene_ids}


@router.post("/script/{script_id}", status_code=201)
async def add_scene(
    script_id: int,
    body: SceneCreate,
    session: AsyncSession = Depends(get_session),
):
    """Add a new blank scene to a script at the end."""
    # Find the max scene_number for this script
    result = await session.execute(
        select(func.max(Scene.scene_number)).where(Scene.script_id == script_id)
    )
    max_num = result.scalar() or 0

    scene = Scene(
        script_id=script_id,
        scene_number=max_num + 1,
        title=body.title,
        location=body.location,
        time_of_day=body.time_of_day,
        description=body.description,
        characters=[],
        mood_tension=0.5,
        mood_emotion=0.5,
        mood_energy=0.5,
        mood_darkness=0.5,
        mood_overall="neutral",
    )
    session.add(scene)
    await session.commit()
    await session.refresh(scene)
    # Re-fetch with shots loaded (empty list)
    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene.id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one()
    return _scene_to_response(scene)


@router.delete("/{scene_id}", status_code=204)
async def delete_scene(
    scene_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a scene and its shots."""
    scene = await session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    await session.delete(scene)
    await session.commit()


@router.put("/shot/{shot_id}/prompt")
async def update_shot_prompt(
    shot_id: int,
    body: ShotPromptUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update the SD prompt for a specific shot."""
    shot = await session.get(Shot, shot_id)
    if not shot:
        raise HTTPException(404, "Shot not found")
    shot.sd_prompt = body.sd_prompt
    await session.commit()
    await session.refresh(shot)
    return {
        "id": shot.id,
        "shot_number": shot.shot_number,
        "sd_prompt": shot.sd_prompt,
    }


@router.post("/{scene_id}/regenerate-frame")
async def regenerate_scene_frame(
    scene_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Regenerate the frame for a scene using the first shot's SD prompt.

    This loads SD, generates the frame, unloads SD, and returns the new path.
    """
    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene_id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(404, "Scene not found")

    shots = sorted(scene.shots, key=lambda s: s.shot_number)
    if not shots or not shots[0].sd_prompt:
        raise HTTPException(400, "No shot with SD prompt available for this scene")

    from services.vram_manager import vram_manager
    from services.image_generator import load_sd_pipeline, generate_frame, unload_sd_pipeline

    try:
        await vram_manager.unload_llm()
        await load_sd_pipeline()
        frame_path = await generate_frame(shots[0].sd_prompt, scene_id, shots[0].shot_number)
        await unload_sd_pipeline()
    except Exception as e:
        try:
            await unload_sd_pipeline()
        except Exception:
            pass
        raise HTTPException(500, f"Frame generation failed: {str(e)}")

    scene.frame_image_path = frame_path
    await session.commit()
    await session.refresh(scene)

    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene_id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one()
    return _scene_to_response(scene)


@router.post("/{scene_id}/regenerate")
async def regenerate_scene(
    scene_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Re-run LLM analysis + SD frame generation for a single scene.

    Uses the scene's current description to re-analyze shots, mood, soundtrack,
    then generates a new frame.
    """
    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene_id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(404, "Scene not found")

    if not scene.description:
        raise HTTPException(400, "Scene has no description to regenerate from")

    from services.vram_manager import vram_manager
    from services.scene_analyzer import analyze_shots, score_mood, suggest_soundtrack, generate_sd_prompts
    from services.image_generator import load_sd_pipeline, generate_frame, unload_sd_pipeline
    from models.schemas import Scene as SceneSchema

    scene_data = SceneSchema(
        scene_number=scene.scene_number,
        title=scene.title,
        location=scene.location or "",
        time_of_day=scene.time_of_day or "day",
        description=scene.description,
        characters=scene.characters or [],
        shots=[],
        mood={"tension": 0.5, "emotion": 0.5, "energy": 0.5, "darkness": 0.5, "overall_mood": "neutral"},
        soundtrack={"genre": "", "tempo": "moderate", "instruments": [], "reference_track": "", "energy_level": 0.5},
    )

    try:
        # Phase 1: LLM analysis
        await vram_manager.load_llm()
        new_shots = await asyncio.to_thread(analyze_shots, scene_data)
        new_mood = await asyncio.to_thread(score_mood, scene_data)
        new_soundtrack = await asyncio.to_thread(suggest_soundtrack, scene_data, new_mood)
        scene_data_with_shots = scene_data.model_copy(update={"shots": new_shots})
        refined_shots = await asyncio.to_thread(generate_sd_prompts, scene_data_with_shots.shots)
        await vram_manager.unload_llm()

        # Update scene fields
        scene.mood_tension = new_mood.tension
        scene.mood_emotion = new_mood.emotion
        scene.mood_energy = new_mood.energy
        scene.mood_darkness = new_mood.darkness
        scene.mood_overall = new_mood.overall_mood
        scene.soundtrack_genre = new_soundtrack.genre
        scene.soundtrack_tempo = new_soundtrack.tempo
        scene.soundtrack_instruments = new_soundtrack.instruments
        scene.soundtrack_reference = new_soundtrack.reference_track
        scene.soundtrack_energy = new_soundtrack.energy_level

        # Delete old shots, add new ones
        for old_shot in scene.shots:
            await session.delete(old_shot)
        await session.flush()

        for shot_data in refined_shots:
            shot_rec = Shot(
                scene_id=scene.id,
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
        await session.flush()

        # Phase 2: Generate frame for first shot
        first_sd_prompt = refined_shots[0].sd_prompt if refined_shots else None
        if first_sd_prompt:
            await load_sd_pipeline()
            frame_path = await generate_frame(first_sd_prompt, scene_id, refined_shots[0].shot_number)
            scene.frame_image_path = frame_path
            await unload_sd_pipeline()

        await session.commit()

    except Exception as e:
        try:
            await vram_manager.unload_llm()
        except Exception:
            pass
        try:
            await unload_sd_pipeline()
        except Exception:
            pass
        raise HTTPException(500, f"Regeneration failed: {str(e)}")

    # Re-fetch with new shots
    result = await session.execute(
        select(Scene)
        .where(Scene.id == scene_id)
        .options(selectinload(Scene.shots))
    )
    scene = result.scalar_one()
    return _scene_to_response(scene)


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _scene_to_response(scene: Scene) -> dict:
    return {
        "id": scene.id,
        "script_id": scene.script_id,
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
                "id": sh.id,
                "shot_number": sh.shot_number,
                "shot_type": sh.shot_type,
                "camera_angle": sh.camera_angle,
                "camera_movement": sh.camera_movement,
                "description": sh.description,
                "dialogue": sh.dialogue,
                "duration_seconds": sh.duration_seconds,
                "sd_prompt": sh.sd_prompt,
            }
            for sh in scene.shots
        ],
    }
