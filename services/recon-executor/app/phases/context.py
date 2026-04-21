"""Shared per-scan context handed to every phase runner."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class PhaseContext:
    scan_id: str
    workspace_id: str
    target_url: str
    # Arbitrary state carried across phases (e.g. the fingerprint map feeds
    # the discovery phase). Phases read / write via string keys.
    state: dict[str, Any] = field(default_factory=dict)


@dataclass
class PhaseResult:
    """Terminal outcome of a phase.

    ``artifact_id`` is optionally the ID of a row inserted into
    ``recon_scan_artifacts`` (e.g. a JSON map of discovered endpoints).
    """

    artifact_id: Optional[str] = None
    summary: Optional[str] = None
