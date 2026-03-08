"""SQLAlchemy ORM models for CutAI."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    genre: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    scripts: Mapped[list["Script"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Script(Base):
    __tablename__ = "scripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    genre: Mapped[str] = mapped_column(String(100), nullable=True)
    logline: Mapped[str] = mapped_column(Text, nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=True)
    total_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    project: Mapped["Project"] = relationship(back_populates="scripts")
    scenes: Mapped[list["Scene"]] = relationship(
        back_populates="script", cascade="all, delete-orphan"
    )


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    script_id: Mapped[int] = mapped_column(Integer, ForeignKey("scripts.id"), nullable=False)
    scene_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=True)
    time_of_day: Mapped[str] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    characters: Mapped[dict] = mapped_column(JSON, default=list)

    # Mood scores
    mood_tension: Mapped[float] = mapped_column(Float, default=0.0)
    mood_emotion: Mapped[float] = mapped_column(Float, default=0.0)
    mood_energy: Mapped[float] = mapped_column(Float, default=0.0)
    mood_darkness: Mapped[float] = mapped_column(Float, default=0.0)
    mood_overall: Mapped[str] = mapped_column(String(100), nullable=True)

    # Soundtrack vibe
    soundtrack_genre: Mapped[str] = mapped_column(String(100), nullable=True)
    soundtrack_tempo: Mapped[str] = mapped_column(String(50), nullable=True)
    soundtrack_instruments: Mapped[dict] = mapped_column(JSON, default=list)
    soundtrack_reference: Mapped[str] = mapped_column(String(255), nullable=True)
    soundtrack_energy: Mapped[float] = mapped_column(Float, default=0.0)

    frame_image_path: Mapped[str] = mapped_column(String(500), nullable=True)

    script: Mapped["Script"] = relationship(back_populates="scenes")
    shots: Mapped[list["Shot"]] = relationship(
        back_populates="scene", cascade="all, delete-orphan"
    )


class Shot(Base):
    __tablename__ = "shots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scene_id: Mapped[int] = mapped_column(Integer, ForeignKey("scenes.id"), nullable=False)
    shot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    shot_type: Mapped[str] = mapped_column(String(50), nullable=False)
    camera_angle: Mapped[str] = mapped_column(String(50), nullable=False)
    camera_movement: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    dialogue: Mapped[str] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=5)
    sd_prompt: Mapped[str] = mapped_column(Text, nullable=True)

    scene: Mapped["Scene"] = relationship(back_populates="shots")
