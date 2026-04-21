"""Phase-state-machine driver for Recon scans.

Implements the DB-status checkpointing pattern from the `pentest-orchestration`
skill. Phase rows live in ``recon_scan_phases`` (schema: migration 051). The
caller invokes :func:`start`, :func:`complete`, :func:`fail`, :func:`cancel`,
or :func:`skip` at each transition, and the helpers enforce the legal state
machine before writing.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional, Protocol


class ReconPhase(str, Enum):
    FINGERPRINTING = "fingerprinting"
    DISCOVERY = "discovery"
    VULN_ANALYSIS = "vuln_analysis"
    EXPLOITATION = "exploitation"
    REPORTING = "reporting"


ORDERED_PHASES: tuple[ReconPhase, ...] = (
    ReconPhase.FINGERPRINTING,
    ReconPhase.DISCOVERY,
    ReconPhase.VULN_ANALYSIS,
    ReconPhase.EXPLOITATION,
    ReconPhase.REPORTING,
)


class PhaseStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


TERMINAL: frozenset[PhaseStatus] = frozenset(
    {PhaseStatus.COMPLETED, PhaseStatus.FAILED, PhaseStatus.SKIPPED, PhaseStatus.CANCELLED}
)

# Which non-terminal states may transition to which next states.
_LEGAL: dict[PhaseStatus, frozenset[PhaseStatus]] = {
    PhaseStatus.PENDING: frozenset(
        {PhaseStatus.RUNNING, PhaseStatus.SKIPPED, PhaseStatus.CANCELLED}
    ),
    PhaseStatus.RUNNING: frozenset(
        {PhaseStatus.COMPLETED, PhaseStatus.FAILED, PhaseStatus.CANCELLED}
    ),
}


class IllegalTransitionError(Exception):
    def __init__(self, current: PhaseStatus, target: PhaseStatus):
        super().__init__(f"Illegal phase transition: {current.value} -> {target.value}")
        self.current = current
        self.target = target


def validate_transition(current: PhaseStatus, target: PhaseStatus) -> None:
    if current in TERMINAL:
        raise IllegalTransitionError(current, target)
    allowed = _LEGAL.get(current, frozenset())
    if target not in allowed:
        raise IllegalTransitionError(current, target)


class DBExecutor(Protocol):
    """Minimal subset of ``asyncpg.Connection`` that the checkpoint helpers use."""

    async def fetchrow(self, query: str, *args: object) -> Optional[dict]:  # pragma: no cover - protocol
        ...

    async def execute(self, query: str, *args: object) -> object:  # pragma: no cover - protocol
        ...


async def _current_status(db: DBExecutor, scan_id: str, phase: ReconPhase) -> PhaseStatus:
    row = await db.fetchrow(
        "SELECT status FROM recon_scan_phases WHERE scan_id = $1 AND phase = $2",
        scan_id,
        phase.value,
    )
    if row is None:
        return PhaseStatus.PENDING
    return PhaseStatus(row["status"])


async def start(db: DBExecutor, scan_id: str, phase: ReconPhase) -> None:
    """Transition a phase into ``running``."""
    current = await _current_status(db, scan_id, phase)
    validate_transition(current, PhaseStatus.RUNNING)
    await db.execute(
        """
        INSERT INTO recon_scan_phases (scan_id, phase, status, started_at)
        VALUES ($1, $2, 'running', now())
        ON CONFLICT (scan_id, phase) DO UPDATE
          SET status = 'running',
              started_at = COALESCE(recon_scan_phases.started_at, now())
        """,
        scan_id,
        phase.value,
    )


async def complete(
    db: DBExecutor,
    scan_id: str,
    phase: ReconPhase,
    output_artifact_id: Optional[str] = None,
) -> None:
    current = await _current_status(db, scan_id, phase)
    validate_transition(current, PhaseStatus.COMPLETED)
    await db.execute(
        """
        INSERT INTO recon_scan_phases (scan_id, phase, status, started_at, completed_at, output_artifact_id)
        VALUES ($1, $2, 'completed', now(), now(), $3)
        ON CONFLICT (scan_id, phase) DO UPDATE
          SET status = 'completed',
              completed_at = now(),
              output_artifact_id = EXCLUDED.output_artifact_id
        """,
        scan_id,
        phase.value,
        output_artifact_id,
    )


async def fail(db: DBExecutor, scan_id: str, phase: ReconPhase, error_message: str) -> None:
    current = await _current_status(db, scan_id, phase)
    validate_transition(current, PhaseStatus.FAILED)
    await db.execute(
        """
        INSERT INTO recon_scan_phases (scan_id, phase, status, started_at, completed_at, error_message)
        VALUES ($1, $2, 'failed', now(), now(), $3)
        ON CONFLICT (scan_id, phase) DO UPDATE
          SET status = 'failed',
              completed_at = now(),
              error_message = EXCLUDED.error_message
        """,
        scan_id,
        phase.value,
        error_message,
    )


async def cancel(db: DBExecutor, scan_id: str, phase: ReconPhase) -> None:
    current = await _current_status(db, scan_id, phase)
    validate_transition(current, PhaseStatus.CANCELLED)
    await db.execute(
        """
        INSERT INTO recon_scan_phases (scan_id, phase, status, started_at, completed_at)
        VALUES ($1, $2, 'cancelled', COALESCE((SELECT started_at FROM recon_scan_phases WHERE scan_id = $1 AND phase = $2), now()), now())
        ON CONFLICT (scan_id, phase) DO UPDATE
          SET status = 'cancelled',
              completed_at = now()
        """,
        scan_id,
        phase.value,
    )


async def skip(db: DBExecutor, scan_id: str, phase: ReconPhase) -> None:
    """Mark a phase as ``skipped``. Only valid from ``pending``."""
    current = await _current_status(db, scan_id, phase)
    validate_transition(current, PhaseStatus.SKIPPED)
    await db.execute(
        """
        INSERT INTO recon_scan_phases (scan_id, phase, status, completed_at)
        VALUES ($1, $2, 'skipped', now())
        ON CONFLICT (scan_id, phase) DO UPDATE
          SET status = 'skipped',
              completed_at = now()
        """,
        scan_id,
        phase.value,
    )
