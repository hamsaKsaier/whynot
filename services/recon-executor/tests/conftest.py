"""Shared fixtures for recon-executor tests.

Uses an in-process fake that mimics the slice of asyncpg the executor touches:
a single ``FakeConn`` that stores ``recon_scan_phases`` rows keyed by
``(scan_id, phase)`` and ``recon_scans`` rows keyed by ``scan_id``. The fake
is sufficient to exercise the phase state machine and orchestrator without
booting Postgres.
"""

from __future__ import annotations

import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import pytest


class FakeConn:
    """Records raw executes + fetchrows against in-memory dicts."""

    def __init__(self, store: "FakeStore"):
        self.store = store

    async def fetchrow(self, query: str, *args: Any) -> dict | None:
        if "recon_scan_phases" in query and "SELECT status" in query:
            return self.store.phases.get((args[0], args[1]))
        if "recon_scans" in query and "cancel_requested_at" in query and "SELECT" in query:
            scan = self.store.scans.get(args[0])
            if scan is None:
                return None
            return {"cancel_requested_at": scan.get("cancel_requested_at")}
        raise AssertionError(f"FakeConn got unexpected fetchrow: {query!r}")

    async def execute(self, query: str, *args: Any) -> None:
        self.store.execute_calls.append((query, args))
        if "INSERT INTO recon_scan_phases" in query:
            self._handle_phase_upsert(query, args)
            return
        if "UPDATE recon_scans" in query:
            self._handle_scan_update(query, args)
            return
        raise AssertionError(f"FakeConn got unexpected execute: {query!r}")

    def _handle_phase_upsert(self, query: str, args: tuple) -> None:
        scan_id, phase = args[0], args[1]
        key = (scan_id, phase)
        row = self.store.phases.setdefault(key, {"scan_id": scan_id, "phase": phase})
        # The query text is a stable template; we read the first status literal.
        m = re.search(r"VALUES \([^,]+, [^,]+, '([a-z]+)'", query)
        status = m.group(1) if m else None
        if status:
            row["status"] = status
        if "started_at" in query and "started_at" not in row:
            row["started_at"] = datetime.now(timezone.utc)
        if "completed_at" in query and status in {"completed", "failed", "cancelled", "skipped"}:
            row["completed_at"] = datetime.now(timezone.utc)
        # Capture error_message if passed as the 3rd arg (fail path).
        if status == "failed" and len(args) >= 3:
            row["error_message"] = args[2]

    def _handle_scan_update(self, query: str, args: tuple) -> None:
        # UPDATE ... WHERE id = $1 — scan_id is arg[0] for simple updates, arg[0]
        # for our heartbeat update, and arg[0] for status updates.
        scan_id = args[0]
        scan = self.store.scans.setdefault(scan_id, {"id": scan_id})
        if "last_heartbeat_at" in query:
            scan["last_heartbeat_at"] = datetime.now(timezone.utc)
            return
        if "status = $2" in query:
            scan["status"] = args[1]
            if "started_at" in query:
                scan.setdefault("started_at", datetime.now(timezone.utc))
            if "completed_at" in query:
                scan["completed_at"] = datetime.now(timezone.utc)
                if len(args) >= 4:
                    scan["error_message"] = args[3]


class FakeStore:
    def __init__(self) -> None:
        self.scans: dict[str, dict] = {}
        self.phases: dict[tuple[str, str], dict] = {}
        self.execute_calls: list[tuple[str, tuple]] = []


class FakeDB:
    """Minimal stand-in for :class:`app.clients.db.ReconDB`."""

    def __init__(self) -> None:
        self.store = FakeStore()
        self._conn = FakeConn(self.store)

    @asynccontextmanager
    async def _ctx(self):
        yield self._conn

    def acquire(self):  # mimics asyncpg pool.acquire()
        return self._ctx()

    async def get_scan(self, scan_id: str) -> dict | None:
        return self.store.scans.get(scan_id)

    async def set_scan_status(self, scan_id: str, status: str, *, error_message: str | None = None) -> None:
        scan = self.store.scans.setdefault(scan_id, {"id": scan_id})
        scan["status"] = status
        if status == "running":
            scan.setdefault("started_at", datetime.now(timezone.utc))
        if status in ("completed", "failed", "cancelled", "stuck"):
            scan["completed_at"] = datetime.now(timezone.utc)
            scan["error_message"] = error_message
        self.store.execute_calls.append((f"set_scan_status:{status}", (scan_id, error_message)))

    async def touch_heartbeat(self, scan_id: str) -> None:
        scan = self.store.scans.setdefault(scan_id, {"id": scan_id})
        scan.setdefault("heartbeat_count", 0)
        scan["heartbeat_count"] += 1
        scan["last_heartbeat_at"] = datetime.now(timezone.utc)

    async def is_cancel_requested(self, scan_id: str) -> bool:
        scan = self.store.scans.get(scan_id)
        return bool(scan and scan.get("cancel_requested_at"))

    async def connect(self) -> None:  # pragma: no cover - noop
        return None

    async def close(self) -> None:  # pragma: no cover - noop
        return None


@pytest.fixture
def fake_db() -> FakeDB:
    return FakeDB()
