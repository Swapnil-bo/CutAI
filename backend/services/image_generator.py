"""Storyboard frame generator.

Cloud-only mode: Replicate SDXL API.
Local Stable Diffusion support disabled for PSU safety.
"""

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
# All torch, diffusers, PIL imports and local SD functions removed.
# If you need local image gen, set IMAGE_PROVIDER=local and re-enable,
# but this will load the GPU and risk PSU power spikes.

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
# Replicate SDXL (production)
# ===================================================================

async def _generate_frame_replicate(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
) -> str:
    """Generate a frame using Replicate SDXL API."""
    import httpx
    import replicate

    output_dir = _ensure_output_dir()

    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

    output = replicate.run(
        REPLICATE_SDXL_MODEL,
        input={
            "prompt": sd_prompt,
            "negative_prompt": SD_NEGATIVE_PROMPT,
            "width": 1024,
            "height": 1024,
            "num_inference_steps": 30,
            "guidance_scale": 7.5,
        },
    )

    # Replicate returns a list of URLs; download the first image
    image_url = output[0] if isinstance(output, list) else str(output)

    filename = f"scene_{scene_id}_shot_{shot_number}.png"
    filepath = output_dir / filename

    async with httpx.AsyncClient() as client:
        resp = await client.get(str(image_url))
        resp.raise_for_status()
        filepath.write_bytes(resp.content)

    return str(filepath)


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

    Auto-dispatches to Replicate SDXL (cloud-only mode).
    Returns None if generation fails (e.g. invalid API token).

    Returns:
        Relative file path to the saved frame image, or None on failure.
    """
    try:
        if IMAGE_PROVIDER == "replicate":
            return await _generate_frame_replicate(sd_prompt, scene_id, shot_number)
        return await _generate_frame_local(sd_prompt, scene_id, shot_number, use_cpu_offload)
    except Exception as e:
        print(f"[CutAI] Frame generation failed for scene {scene_id} shot {shot_number}: {e}")
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
