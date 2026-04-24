"""Typed DB client for the recon-executor.

Thin wrapper around asyncpg that exposes only the queries the orchestrator
and phase runners need. All queries are pre-authored here so auditing rule 8
(multi-tenancy: every recon query filters by workspace_id where workspace is
in scope) can be done in one file.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import asyncpg


class ReconDB:
    """Connection pool + query helpers for recon tables."""

    def __init__(self, dsn: str):
        self._dsn = dsn
        self._pool: Optional[asyncpg.Pool] = None

    @classmethod
    def from_env(cls) -> "ReconDB":
        dsn = os.getenv("DATABASE_URL")
        if not dsn:
            raise RuntimeError("DATABASE_URL must be set for recon-executor")
        return cls(dsn)

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    def _ensure_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("ReconDB not connected; call connect() first")
        return self._pool

    # ─── recon_scans ──────────────────────────────────────────────

    async def get_scan(self, scan_id: str) -> Optional[dict]:
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, workspace_id, project_id, environment_id, target_url, status,
                       cancel_requested_at, last_heartbeat_at
                FROM recon_scans
                WHERE id = $1
                """,
                scan_id,
            )
            return dict(row) if row else None

    async def set_scan_status(
        self,
        scan_id: str,
        status: str,
        *,
        error_message: Optional[str] = None,
    ) -> None:
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            now = datetime.now(timezone.utc)
            if status == "running":
                await conn.execute(
                    """UPDATE recon_scans
                       SET status = $2,
                           started_at = COALESCE(started_at, $3),
                           error_message = NULL
                       WHERE id = $1""",
                    scan_id,
                    status,
                    now,
                )
            elif status in ("completed", "failed", "cancelled", "stuck"):
                await conn.execute(
                    """UPDATE recon_scans
                       SET status = $2,
                           completed_at = $3,
                           error_message = $4
                       WHERE id = $1""",
                    scan_id,
                    status,
                    now,
                    error_message,
                )
            else:
                await conn.execute(
                    "UPDATE recon_scans SET status = $2 WHERE id = $1",
                    scan_id,
                    status,
                )

    async def touch_heartbeat(self, scan_id: str) -> None:
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE recon_scans SET last_heartbeat_at = now() WHERE id = $1",
                scan_id,
            )

    async def is_cancel_requested(self, scan_id: str) -> bool:
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT cancel_requested_at FROM recon_scans WHERE id = $1",
                scan_id,
            )
            return row is not None and row["cancel_requested_at"] is not None

    def acquire(self):
        """Return an async context manager yielding a raw ``asyncpg.Connection``.

        Used by the checkpoint helpers which operate on any DB executor.
        Not a coroutine — returns the pool's ``PoolAcquireContext`` directly.
        """
        return self._ensure_pool().acquire()
