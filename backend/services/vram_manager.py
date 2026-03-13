"""VRAM Manager — cloud-only no-op passthrough.

All torch, ollama, and GPU management code disabled for PSU safety.
The app runs entirely on cloud APIs (Groq + Replicate).
"""

import gc


class VRAMManager:
    """No-op singleton — all methods are passthroughs in cloud-only mode."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.current_model = None
            cls._instance.sd_pipeline = None
        return cls._instance

    async def load_llm(self):
        """No-op — Groq is cloud-based, no VRAM needed."""
        return

    async def load_sd(self):
        """No-op — Replicate is cloud-based, no VRAM needed."""
        return

    async def unload_llm(self):
        """No-op — nothing to unload in cloud-only mode."""
        gc.collect()
        self.current_model = None

    async def unload_sd(self):
        """No-op — nothing to unload in cloud-only mode."""
        if self.sd_pipeline is not None:
            del self.sd_pipeline
            self.sd_pipeline = None
        gc.collect()
        self.current_model = None

    async def verify_vram_clear(self):
        """No-op — no GPU to check in cloud-only mode."""
        return "Cloud-only mode — no local GPU usage"


# Module-level singleton
vram_manager = VRAMManager()
