"""Storyboard frame generator.

Supports two providers:
- local: Stable Diffusion 1.5 via diffusers (float16, CUDA, VRAM-optimized)
- replicate: SDXL via Replicate cloud API

Integrates with VRAMManager for local mode to ensure LLM is unloaded first.
"""

import os
from pathlib import Path

from config import (
    IMAGE_PROVIDER,
    GENERATED_FRAMES_DIR,
    SD_GUIDANCE_SCALE,
    SD_HEIGHT,
    SD_INFERENCE_STEPS,
    SD_MODEL_ID,
    SD_NEGATIVE_PROMPT,
    SD_WIDTH,
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
# Local SD 1.5 pipeline (RTX 3050 6GB)
# ===================================================================

def _load_pipeline():
    """Load SD 1.5 pipeline with float16 and VRAM optimizations.

    ALL THREE optimizations for 6GB VRAM:
    1. enable_attention_slicing() — halves attention layer VRAM usage
    2. enable_vae_slicing() — prevents VRAM spike during VAE decode
    3. enable_model_cpu_offload() — available as fallback if still OOM
    """
    import torch
    from diffusers import StableDiffusionPipeline

    pipe = StableDiffusionPipeline.from_pretrained(
        SD_MODEL_ID,
        torch_dtype=torch.float16,
        safety_checker=None,  # Disable for speed + VRAM savings on storyboard use
    )
    pipe = pipe.to("cuda")

    # Required VRAM optimizations for RTX 3050 6GB
    pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()

    return pipe


def _load_pipeline_with_cpu_offload():
    """Fallback loader using model_cpu_offload for extreme VRAM pressure.

    Slower but guaranteed to fit in 6GB. Use only if _load_pipeline() OOMs.
    NOTE: Do NOT call pipe.to("cuda") when using cpu_offload — it manages
    device placement automatically.
    """
    import torch
    from diffusers import StableDiffusionPipeline

    pipe = StableDiffusionPipeline.from_pretrained(
        SD_MODEL_ID,
        torch_dtype=torch.float16,
        safety_checker=None,
    )

    pipe.enable_model_cpu_offload()
    pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()

    return pipe


async def _generate_frame_local(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
    use_cpu_offload: bool = False,
) -> str:
    """Generate a frame using local SD 1.5 pipeline."""
    import torch
    from PIL import Image

    output_dir = _ensure_output_dir()

    # Ensure SD pipeline is loaded
    if vram_manager.sd_pipeline is None:
        await load_sd_pipeline(use_cpu_offload=use_cpu_offload)

    pipe = vram_manager.sd_pipeline

    # Generate the image
    with torch.no_grad():
        result = pipe(
            prompt=sd_prompt,
            negative_prompt=SD_NEGATIVE_PROMPT,
            width=SD_WIDTH,
            height=SD_HEIGHT,
            num_inference_steps=SD_INFERENCE_STEPS,
            guidance_scale=SD_GUIDANCE_SCALE,
        )

    image: Image.Image = result.images[0]

    # Save to generated/frames/scene_{id}_shot_{number}.png
    filename = f"scene_{scene_id}_shot_{shot_number}.png"
    filepath = output_dir / filename
    image.save(filepath, format="PNG")

    return str(filepath)


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
    """Load the SD pipeline into VRAM via the VRAMManager (local mode only).

    No-op for Replicate provider (cloud-based, no local pipeline).
    """
    if IMAGE_PROVIDER == "replicate":
        return

    # VRAMManager.load_sd() handles unloading LLM if needed
    await vram_manager.load_sd()

    if vram_manager.sd_pipeline is None:
        if use_cpu_offload:
            vram_manager.sd_pipeline = _load_pipeline_with_cpu_offload()
        else:
            vram_manager.sd_pipeline = _load_pipeline()


async def unload_sd_pipeline() -> None:
    """Unload SD pipeline and free VRAM (local mode only)."""
    if IMAGE_PROVIDER == "replicate":
        return
    await vram_manager.unload_sd()


async def generate_frame(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
    use_cpu_offload: bool = False,
) -> str:
    """Generate a single storyboard frame and save as PNG.

    Auto-dispatches to local SD 1.5 or Replicate SDXL based on IMAGE_PROVIDER.

    Returns:
        Relative file path to the saved frame image.
    """
    if IMAGE_PROVIDER == "replicate":
        return await _generate_frame_replicate(sd_prompt, scene_id, shot_number)
    return await _generate_frame_local(sd_prompt, scene_id, shot_number, use_cpu_offload)


async def generate_frames_for_scene(
    shots: list[dict],
    scene_id: int,
    use_cpu_offload: bool = False,
) -> list[str]:
    """Generate frames for all shots in a scene.

    Loads SD once (local mode), generates all frames, then the caller is
    responsible for unloading via unload_sd_pipeline() when all scenes are done.

    Returns:
        List of file paths to generated frame images.
    """
    # Ensure pipeline is loaded (no-op for replicate)
    if IMAGE_PROVIDER != "replicate" and vram_manager.sd_pipeline is None:
        await load_sd_pipeline(use_cpu_offload=use_cpu_offload)

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
