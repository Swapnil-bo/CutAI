"""Storyboard frame generator.

Cloud-only mode: Replicate Stable Diffusion API.
Local Stable Diffusion support disabled for PSU safety.
"""

import asyncio
import os
from pathlib import Path

from config import (
    IMAGE_PROVIDER,
    GENERATED_FRAMES_DIR,
    SD_NEGATIVE_PROMPT,
    REPLICATE_API_TOKEN,
    REPLICATE_SDXL_MODEL,
)
from services.vram_manager import vram_manager


def _ensure_output_dir() -> Path:
    """Create the output directory if it doesn't exist."""
    path = Path(GENERATED_FRAMES_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


# ===================================================================
# Local SD 1.5 pipeline — DISABLED (PSU safety)
# ===================================================================

async def _generate_frame_local(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
    use_cpu_offload: bool = False,
) -> str:
    """Disabled — local SD not available in cloud-only mode."""
    raise RuntimeError(
        "Local SD disabled — use Replicate. Set IMAGE_PROVIDER=replicate in your environment."
    )


# ===================================================================
# Replicate Stable Diffusion (production)
# ===================================================================

def _run_replicate_sync(model: str, sd_prompt: str, negative_prompt: str) -> str:
    """Run replicate.run() synchronously and return the image URL string.

    This is called via asyncio.to_thread() because replicate.run() blocks.
    """
    import replicate

    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

    print(f"[CutAI] Calling Replicate model: {model}")
    print(f"[CutAI] Prompt: {sd_prompt[:100]}...")

    output = replicate.run(
        model,
        input={
            "prompt": sd_prompt,
            "width": 512,
            "height": 512,
            "num_outputs": 1,
            "negative_prompt": negative_prompt,
        },
    )

    print(f"[CutAI] Replicate raw output type: {type(output)}")
    print(f"[CutAI] Replicate raw output: {output}")

    # Replicate can return a list of URLs, a FileOutput iterator, or a single URL.
    # Handle all cases robustly.
    if isinstance(output, list):
        image_url = str(output[0])
    elif hasattr(output, '__iter__'):
        # FileOutput or iterator — grab first item
        image_url = str(next(iter(output)))
    else:
        image_url = str(output)

    print(f"[CutAI] Resolved image URL: {image_url}")
    return image_url


async def _generate_frame_replicate(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
) -> str:
    """Generate a frame using Replicate Stable Diffusion API."""
    import httpx

    output_dir = _ensure_output_dir()

    # Run replicate.run() in a thread to avoid blocking the event loop
    image_url = await asyncio.to_thread(
        _run_replicate_sync,
        REPLICATE_SDXL_MODEL,
        sd_prompt,
        SD_NEGATIVE_PROMPT,
    )

    filename = f"scene_{scene_id}_shot_{shot_number}.png"
    filepath = output_dir / filename

    print(f"[CutAI] Downloading frame from: {image_url}")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(str(image_url))
        resp.raise_for_status()
        filepath.write_bytes(resp.content)

    print(f"[CutAI] Frame saved to: {filepath}")
    print(f"[CutAI] File size: {filepath.stat().st_size} bytes")

    # Return forward-slash relative path for URL compatibility
    relative_path = f"generated/frames/{filename}"
    print(f"[CutAI] Returning relative path: {relative_path}")
    return relative_path


# ===================================================================
# Public API — auto-dispatches based on IMAGE_PROVIDER
# ===================================================================

async def load_sd_pipeline(use_cpu_offload: bool = False) -> None:
    """No-op — local SD pipeline disabled in cloud-only mode."""
    if IMAGE_PROVIDER == "replicate":
        return
    raise RuntimeError(
        "Local SD disabled — use Replicate. Set IMAGE_PROVIDER=replicate in your environment."
    )


async def unload_sd_pipeline() -> None:
    """No-op — local SD pipeline disabled in cloud-only mode."""
    return


async def generate_frame(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
    use_cpu_offload: bool = False,
) -> str | None:
    """Generate a single storyboard frame and save as PNG.

    Auto-dispatches to Replicate (cloud-only mode).
    Returns None if generation fails.

    Returns:
        Relative file path to the saved frame image, or None on failure.
    """
    try:
        print(f"[CutAI] generate_frame called: scene={scene_id}, shot={shot_number}, provider={IMAGE_PROVIDER}")
        if IMAGE_PROVIDER == "replicate":
            return await _generate_frame_replicate(sd_prompt, scene_id, shot_number)
        return await _generate_frame_local(sd_prompt, scene_id, shot_number, use_cpu_offload)
    except Exception as e:
        print(f"[CutAI] Frame generation FAILED for scene {scene_id} shot {shot_number}: {e}")
        import traceback
        traceback.print_exc()
        return None


async def generate_frames_for_scene(
    shots: list[dict],
    scene_id: int,
    use_cpu_offload: bool = False,
) -> list[str | None]:
    """Generate frames for all shots in a scene.

    Returns:
        List of file paths (or None for failed frames).
    """
    paths = []
    for shot in shots:
        path = await generate_frame(
            sd_prompt=shot["sd_prompt"],
            scene_id=scene_id,
            shot_number=shot["shot_number"],
            use_cpu_offload=use_cpu_offload,
        )
        paths.append(path)

    return paths
