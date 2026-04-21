"""Unit tests for the phase state machine helpers in :mod:`app.checkpoint`."""

from __future__ import annotations

import pytest

from app import checkpoint
from app.checkpoint import (
    IllegalTransitionError,
    ORDERED_PHASES,
    PhaseStatus,
    ReconPhase,
    TERMINAL,
    validate_transition,
)


# ─── validate_transition ─────────────────────────────────────────────

class TestValidateTransition:
    def test_pending_to_running_is_allowed(self):
        validate_transition(PhaseStatus.PENDING, PhaseStatus.RUNNING)

    def test_pending_to_skipped_is_allowed(self):
        validate_transition(PhaseStatus.PENDING, PhaseStatus.SKIPPED)

    def test_pending_to_cancelled_is_allowed(self):
        validate_transition(PhaseStatus.PENDING, PhaseStatus.CANCELLED)

    def test_running_to_completed_is_allowed(self):
        validate_transition(PhaseStatus.RUNNING, PhaseStatus.COMPLETED)

    def test_running_to_failed_is_allowed(self):
        validate_transition(PhaseStatus.RUNNING, PhaseStatus.FAILED)

    def test_running_to_cancelled_is_allowed(self):
        validate_transition(PhaseStatus.RUNNING, PhaseStatus.CANCELLED)

    @pytest.mark.parametrize("terminal", list(TERMINAL))
    def test_terminal_states_cannot_transition(self, terminal):
        with pytest.raises(IllegalTransitionError):
            validate_transition(terminal, PhaseStatus.RUNNING)

    def test_pending_to_completed_is_illegal(self):
        with pytest.raises(IllegalTransitionError):
            validate_transition(PhaseStatus.PENDING, PhaseStatus.COMPLETED)

    def test_pending_to_failed_is_illegal(self):
        with pytest.raises(IllegalTransitionError):
            validate_transition(PhaseStatus.PENDING, PhaseStatus.FAILED)

    def test_running_to_skipped_is_illegal(self):
        with pytest.raises(IllegalTransitionError):
            validate_transition(PhaseStatus.RUNNING, PhaseStatus.SKIPPED)

    def test_illegal_transition_error_exposes_fields(self):
        with pytest.raises(IllegalTransitionError) as exc_info:
            validate_transition(PhaseStatus.COMPLETED, PhaseStatus.RUNNING)
        assert exc_info.value.current == PhaseStatus.COMPLETED
        assert exc_info.value.target == PhaseStatus.RUNNING


# ─── phase order ─────────────────────────────────────────────────────

def test_ordered_phases_is_the_canonical_five():
    assert ORDERED_PHASES == (
        ReconPhase.FINGERPRINTING,
        ReconPhase.DISCOVERY,
        ReconPhase.VULN_ANALYSIS,
        ReconPhase.EXPLOITATION,
        ReconPhase.REPORTING,
    )


# ─── checkpoint helpers against FakeConn ─────────────────────────────

@pytest.mark.asyncio
class TestCheckpointOnFakeDB:
    async def test_start_writes_running_row(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.start(conn, "scan-1", ReconPhase.FINGERPRINTING)
        row = fake_db.store.phases[("scan-1", "fingerprinting")]
        assert row["status"] == "running"

    async def test_complete_after_start_succeeds(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.start(conn, "scan-1", ReconPhase.FINGERPRINTING)
            await checkpoint.complete(conn, "scan-1", ReconPhase.FINGERPRINTING)
        assert fake_db.store.phases[("scan-1", "fingerprinting")]["status"] == "completed"

    async def test_cannot_complete_without_starting(self, fake_db):
        async with fake_db.acquire() as conn:
            with pytest.raises(IllegalTransitionError):
                await checkpoint.complete(conn, "scan-1", ReconPhase.FINGERPRINTING)

    async def test_fail_records_error_message(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.start(conn, "scan-1", ReconPhase.DISCOVERY)
            await checkpoint.fail(conn, "scan-1", ReconPhase.DISCOVERY, "boom")
        row = fake_db.store.phases[("scan-1", "discovery")]
        assert row["status"] == "failed"
        assert row["error_message"] == "boom"

    async def test_skip_is_valid_from_pending(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.skip(conn, "scan-1", ReconPhase.REPORTING)
        assert fake_db.store.phases[("scan-1", "reporting")]["status"] == "skipped"

    async def test_skip_of_running_is_illegal(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.start(conn, "scan-1", ReconPhase.REPORTING)
            with pytest.raises(IllegalTransitionError):
                await checkpoint.skip(conn, "scan-1", ReconPhase.REPORTING)

    async def test_cancel_of_running_records_cancelled(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.start(conn, "scan-1", ReconPhase.EXPLOITATION)
            await checkpoint.cancel(conn, "scan-1", ReconPhase.EXPLOITATION)
        assert fake_db.store.phases[("scan-1", "exploitation")]["status"] == "cancelled"

    async def test_cannot_restart_completed_phase(self, fake_db):
        async with fake_db.acquire() as conn:
            await checkpoint.start(conn, "scan-1", ReconPhase.FINGERPRINTING)
            await checkpoint.complete(conn, "scan-1", ReconPhase.FINGERPRINTING)
            with pytest.raises(IllegalTransitionError):
                await checkpoint.start(conn, "scan-1", ReconPhase.FINGERPRINTING)
