"""Phase runners for the 5-stage Recon pipeline.

Each phase exposes a single async entry point ``run(ctx)`` that returns a
``PhaseResult``. The orchestrator calls these in order and checkpoints the
phase-row state between them. Phase implementations stay thin here — real
tool orchestration lives inside each module but is driven through the same
``PhaseContext`` so unit tests can mock everything at the seam.
"""

from .context import PhaseContext, PhaseResult

__all__ = ["PhaseContext", "PhaseResult"]
