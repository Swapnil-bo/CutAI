"""CRUD routes for projects."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import get_session
from models.db_models import Project, Script, Scene, Shot
from models.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    session: AsyncSession = Depends(get_session),
):
    project = Project(title=body.title, genre=body.genre)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return _to_response(project)


@router.get("")
async def list_projects(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Project)
        .options(
            selectinload(Project.scripts)
            .selectinload(Script.scenes)
        )
        .order_by(Project.updated_at.desc())
    )
    return [_to_response_with_stats(p) for p in result.scalars().all()]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return _to_response(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    await session.delete(project)
    await session.commit()


@router.post("/{project_id}/duplicate", response_model=ProjectResponse, status_code=201)
async def duplicate_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Deep-copy a project with all scripts, scenes, and shots."""
    result = await session.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.scripts)
            .selectinload(Script.scenes)
            .selectinload(Scene.shots)
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Project not found")

    new_project = Project(
        title=f"{original.title} (Copy)",
        genre=original.genre,
    )
    session.add(new_project)
    await session.flush()

    for script in original.scripts:
        new_script = Script(
            project_id=new_project.id,
            title=script.title,
            genre=script.genre,
            logline=script.logline,
            raw_text=script.raw_text,
            total_duration_seconds=script.total_duration_seconds,
        )
        session.add(new_script)
        await session.flush()

        for scene in script.scenes:
            new_scene = Scene(
                script_id=new_script.id,
                scene_number=scene.scene_number,
                title=scene.title,
                location=scene.location,
                time_of_day=scene.time_of_day,
                description=scene.description,
                characters=scene.characters,
                mood_tension=scene.mood_tension,
                mood_emotion=scene.mood_emotion,
                mood_energy=scene.mood_energy,
                mood_darkness=scene.mood_darkness,
                mood_overall=scene.mood_overall,
                soundtrack_genre=scene.soundtrack_genre,
                soundtrack_tempo=scene.soundtrack_tempo,
                soundtrack_instruments=scene.soundtrack_instruments,
                soundtrack_reference=scene.soundtrack_reference,
                soundtrack_energy=scene.soundtrack_energy,
                frame_image_path=scene.frame_image_path,
            )
            session.add(new_scene)
            await session.flush()

            for shot in scene.shots:
                new_shot = Shot(
                    scene_id=new_scene.id,
                    shot_number=shot.shot_number,
                    shot_type=shot.shot_type,
                    camera_angle=shot.camera_angle,
                    camera_movement=shot.camera_movement,
                    description=shot.description,
                    dialogue=shot.dialogue,
                    duration_seconds=shot.duration_seconds,
                    sd_prompt=shot.sd_prompt,
                )
                session.add(new_shot)

    await session.commit()
    await session.refresh(new_project)
    return _to_response(new_project)


def _to_response(project: Project) -> dict:
    return {
        "id": project.id,
        "title": project.title,
        "genre": project.genre,
        "created_at": project.created_at.isoformat() if project.created_at else "",
        "updated_at": project.updated_at.isoformat() if project.updated_at else "",
    }


def _to_response_with_stats(project: Project) -> dict:
    """Include scene_count and first frame thumbnail for the project list."""
    scenes = []
    for script in (project.scripts or []):
        scenes.extend(script.scenes or [])
    first_frame = None
    for scene in sorted(scenes, key=lambda s: s.scene_number):
        if scene.frame_image_path:
            first_frame = scene.frame_image_path
            break
    return {
        "id": project.id,
        "title": project.title,
        "genre": project.genre,
        "created_at": project.created_at.isoformat() if project.created_at else "",
        "updated_at": project.updated_at.isoformat() if project.updated_at else "",
        "scene_count": len(scenes),
        "thumbnail": first_frame,
    }
