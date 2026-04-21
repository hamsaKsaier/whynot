"""Scan orchestrator.

Drives a Recon scan through its 5 phases sequentially, checkpointing phase
status into ``recon_scan_phases`` at every boundary and writing the overall
scan status into ``recon_scans`` on terminal states.

Alongside the main phase loop, two background tasks run for the duration of
a scan:

  * **heartbeat_loop** — writes ``recon_scans.last_heartbeat_at = now()``
    every ``HEARTBEAT_INTERVAL_SECONDS``. If this stops, an external monitor
    may mark the scan ``stuck`` after ``STUCK_AFTER_SECONDS`` of silence.
  * **cancel_watcher** — polls ``recon_scans.cancel_requested_at`` every
    ``CANCEL_POLL_INTERVAL_SECONDS``; on detection it sets an
    ``asyncio.Event`` that the phase runner checks between phases and
    inside long-running fan-outs.

On uncaught exceptions the orchestrator marks the scan ``failed`` and writes
the remaining phases as ``skipped`` (per the pentest-orchestration skill:
"failure in phase N marks phases N+1..5 as skipped, not run").
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from app import checkpoint
from app.checkpoint import ORDERED_PHASES, PhaseStatus, ReconPhase
from app.clients.db import ReconDB
from app.phases import PhaseContext, PhaseResult
from app.phases import discovery, exploitation, fingerprinting, reporting, vuln_analysis

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SECONDS = 30
CANCEL_POLL_INTERVAL_SECONDS = 10
STUCK_AFTER_SECONDS = 5 * 60

PhaseRunner = Callable[[PhaseContext], Awaitable[PhaseResult]]

DEFAULT_RUNNERS: dict[ReconPhase, PhaseRunner] = {
    ReconPhase.FINGERPRINTING: fingerprinting.run,
    ReconPhase.DISCOVERY: discovery.run,
    ReconPhase.VULN_ANALYSIS: vuln_analysis.run,
    ReconPhase.EXPLOITATION: exploitation.run,
    ReconPhase.REPORTING: reporting.run,
}


@dataclass
class OrchestratorClocks:
    """Tunable intervals. Kept on an object so tests can shorten them."""

    heartbeat: float = float(HEARTBEAT_INTERVAL_SECONDS)
    cancel_poll: float = float(CANCEL_POLL_INTERVAL_SECONDS)


class Orchestrator:
    def __init__(
        self,
        db: ReconDB,
        *,
        runners: Optional[dict[ReconPhase, PhaseRunner]] = None,
        clocks: Optional[OrchestratorClocks] = None,
    ):
        self.db = db
        self.runners = runners or DEFAULT_RUNNERS
        self.clocks = clocks or OrchestratorClocks()

    async def run_scan(self, scan_id: str) -> None:
        """Main entry point. Never raises — all errors are captured and written
        to the DB so the HTTP handler that spawned this task can remain thin.
        """
        scan = await self.db.get_scan(scan_id)
        if scan is None:
            logger.error("run_scan called with unknown scan_id=%s", scan_id)
            return
        if scan["status"] != "pending":
            logger.error(
                "run_scan refused: scan %s is in status %s (must be 'pending')",
                scan_id,
                scan["status"],
            )
            return

        await self.db.set_scan_status(scan_id, "running")

        ctx = PhaseContext(
            scan_id=scan_id,
            workspace_id=str(scan["workspace_id"]),
            target_url=scan["target_url"],
        )
        cancel_event = asyncio.Event()

        heartbeat_task = asyncio.create_task(self._heartbeat_loop(scan_id, cancel_event))
        cancel_task = asyncio.create_task(self._cancel_watcher(scan_id, cancel_event))

        try:
            await self._run_phases(ctx, cancel_event)
        except _CancelledByUser:
            await self._finalize_cancelled(scan_id)
        except Exception as e:  # noqa: BLE001 - exhaustive top-level guard
            logger.exception("orchestrator crashed for scan %s", scan_id)
            await self._finalize_failed(scan_id, str(e))
        else:
            await self.db.set_scan_status(scan_id, "completed")
        finally:
            cancel_event.set()  # signal heartbeat / cancel_watcher to exit
            for t in (heartbeat_task, cancel_task):
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):
                    pass

    # ─── internals ────────────────────────────────────────────────

    async def _run_phases(self, ctx: PhaseContext, cancel_event: asyncio.Event) -> None:
        for idx, phase in enumerate(ORDERED_PHASES):
            if await self._cancellation_pending(ctx.scan_id, cancel_event):
                await self._skip_remaining(ORDERED_PHASES[idx:], ctx.scan_id)
                raise _CancelledByUser()

            await self._start_phase(ctx.scan_id, phase)
            try:
                runner = self.runners[phase]
                await runner(ctx)
            except Exception as e:  # noqa: BLE001 - per-phase boundary
                logger.exception("phase %s failed for scan %s", phase.value, ctx.scan_id)
                await self._fail_phase(ctx.scan_id, phase, str(e))
                await self._skip_remaining(ORDERED_PHASES[idx + 1:], ctx.scan_id)
                raise

            if await self._cancellation_pending(ctx.scan_id, cancel_event):
                await self._cancel_phase(ctx.scan_id, phase)
                await self._skip_remaining(ORDERED_PHASES[idx + 1:], ctx.scan_id)
                raise _CancelledByUser()

            await self._complete_phase(ctx.scan_id, phase)

    async def _cancellation_pending(self, scan_id: str, cancel_event: asyncio.Event) -> bool:
        """Direct-check cancellation so we don't depend on the watcher's cadence.

        The background watcher still runs so a cancel request that arrives
        mid-phase (during a long tool call) is picked up without the phase
        having to poll explicitly — but between phases we always authoritative-
        check the DB here. Once set, the event is monotonic.
        """
        if cancel_event.is_set():
            return True
        try:
            if await self.db.is_cancel_requested(scan_id):
                cancel_event.set()
                return True
        except Exception as e:  # noqa: BLE001 - a failing poll should never break the scan
            logger.warning("direct cancel check failed for %s: %s", scan_id, e)
        return False

    async def _start_phase(self, scan_id: str, phase: ReconPhase) -> None:
        async with self.db.acquire() as conn:
            await checkpoint.start(conn, scan_id, phase)

    async def _complete_phase(self, scan_id: str, phase: ReconPhase) -> None:
        async with self.db.acquire() as conn:
            await checkpoint.complete(conn, scan_id, phase)

    async def _fail_phase(self, scan_id: str, phase: ReconPhase, msg: str) -> None:
        async with self.db.acquire() as conn:
            await checkpoint.fail(conn, scan_id, phase, msg)

    async def _cancel_phase(self, scan_id: str, phase: ReconPhase) -> None:
        async with self.db.acquire() as conn:
            await checkpoint.cancel(conn, scan_id, phase)

    async def _skip_remaining(
        self,
        remaining: tuple[ReconPhase, ...] | list[ReconPhase],
        scan_id: str,
    ) -> None:
        """Mark every phase that has not yet started as ``skipped``.

        Phases already in a non-pending state are left alone so that the
        cancellation or failure that put them there is preserved.
        """
        async with self.db.acquire() as conn:
            for phase in remaining:
                row = await conn.fetchrow(
                    "SELECT status FROM recon_scan_phases WHERE scan_id = $1 AND phase = $2",
                    scan_id,
                    phase.value,
                )
                current = PhaseStatus(row["status"]) if row else PhaseStatus.PENDING
                if current == PhaseStatus.PENDING:
                    await checkpoint.skip(conn, scan_id, phase)

    async def _finalize_failed(self, scan_id: str, msg: str) -> None:
        await self.db.set_scan_status(scan_id, "failed", error_message=msg)

    async def _finalize_cancelled(self, scan_id: str) -> None:
        await self.db.set_scan_status(scan_id, "cancelled")

    async def _heartbeat_loop(self, scan_id: str, stop_event: asyncio.Event) -> None:
        """Write ``last_heartbeat_at`` every :attr:`OrchestratorClocks.heartbeat` seconds."""
        while not stop_event.is_set():
            try:
                await self.db.touch_heartbeat(scan_id)
            except Exception as e:  # noqa: BLE001 - log and keep running
                logger.warning("heartbeat failed for scan %s: %s", scan_id, e)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.clocks.heartbeat)
            except asyncio.TimeoutError:
                continue

    async def _cancel_watcher(self, scan_id: str, cancel_event: asyncio.Event) -> None:
        while not cancel_event.is_set():
            try:
                if await self.db.is_cancel_requested(scan_id):
                    cancel_event.set()
                    return
            except Exception as e:  # noqa: BLE001 - never fail the scan over a poll hiccup
                logger.warning("cancel poll failed for scan %s: %s", scan_id, e)
            try:
                await asyncio.wait_for(cancel_event.wait(), timeout=self.clocks.cancel_poll)
            except asyncio.TimeoutError:
                continue


class _CancelledByUser(Exception):
    """Internal signal raised by :meth:`Orchestrator._run_phases` on cancellation."""
