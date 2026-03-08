"""Stable Diffusion 1.5 storyboard frame generator.

Loads SD 1.5 in float16 on CUDA with VRAM optimizations
(attention slicing + VAE slicing) to fit within RTX 3050 6GB.
Integrates with VRAMManager to ensure LLM is unloaded before loading SD.
"""

import os
from pathlib import Path

import torch
from diffusers import StableDiffusionPipeline
from PIL import Image

from config import (
    GENERATED_FRAMES_DIR,
    SD_GUIDANCE_SCALE,
    SD_HEIGHT,
    SD_INFERENCE_STEPS,
    SD_MODEL_ID,
    SD_NEGATIVE_PROMPT,
    SD_WIDTH,
)
from services.vram_manager import vram_manager


def _ensure_output_dir() -> Path:
    """Create the output directory if it doesn't exist."""
    path = Path(GENERATED_FRAMES_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _load_pipeline() -> StableDiffusionPipeline:
    """Load SD 1.5 pipeline with float16 and VRAM optimizations.

    ALL THREE optimizations for 6GB VRAM:
    1. enable_attention_slicing() — halves attention layer VRAM usage
    2. enable_vae_slicing() — prevents VRAM spike during VAE decode
    3. enable_model_cpu_offload() — available as fallback if still OOM
    """
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


def _load_pipeline_with_cpu_offload() -> StableDiffusionPipeline:
    """Fallback loader using model_cpu_offload for extreme VRAM pressure.

    Slower but guaranteed to fit in 6GB. Use only if _load_pipeline() OOMs.
    NOTE: Do NOT call pipe.to("cuda") when using cpu_offload — it manages
    device placement automatically.
    """
    pipe = StableDiffusionPipeline.from_pretrained(
        SD_MODEL_ID,
        torch_dtype=torch.float16,
        safety_checker=None,
    )

    pipe.enable_model_cpu_offload()
    pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()

    return pipe


async def load_sd_pipeline(use_cpu_offload: bool = False) -> None:
    """Load the SD pipeline into VRAM via the VRAMManager.

    Ensures LLM is unloaded first, then loads SD.
    """
    # VRAMManager.load_sd() handles unloading LLM if needed
    await vram_manager.load_sd()

    if vram_manager.sd_pipeline is None:
        if use_cpu_offload:
            vram_manager.sd_pipeline = _load_pipeline_with_cpu_offload()
        else:
            vram_manager.sd_pipeline = _load_pipeline()


async def unload_sd_pipeline() -> None:
    """Unload SD pipeline and free VRAM."""
    await vram_manager.unload_sd()


async def generate_frame(
    sd_prompt: str,
    scene_id: int,
    shot_number: int,
    use_cpu_offload: bool = False,
) -> str:
    """Generate a single storyboard frame and save as PNG.

    Args:
        sd_prompt: Optimized prompt for Stable Diffusion.
        scene_id: Scene identifier for filename.
        shot_number: Shot number within the scene.
        use_cpu_offload: If True, use CPU offload fallback for tight VRAM.

    Returns:
        Relative file path to the saved frame image.
    """
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

    # Return relative path (for DB storage and API responses)
    return str(filepath)


async def generate_frames_for_scene(
    shots: list[dict],
    scene_id: int,
    use_cpu_offload: bool = False,
) -> list[str]:
    """Generate frames for all shots in a scene.

    Loads SD once, generates all frames, then the caller is responsible
    for unloading via unload_sd_pipeline() when all scenes are done.

    Args:
        shots: List of dicts with at least 'shot_number' and 'sd_prompt' keys.
        scene_id: Scene identifier.
        use_cpu_offload: If True, use CPU offload fallback.

    Returns:
        List of file paths to generated frame images.
    """
    # Ensure pipeline is loaded
    if vram_manager.sd_pipeline is None:
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
