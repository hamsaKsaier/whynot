"""Fixtures for recon-executor integration tests.

These tests require a real Postgres (the ``postgres-test`` compose service with
all migrations applied) and, for the happy-path scenario, a running juice-shop
instance. Every other I/O seam is mocked inside the test process so the suite
stays deterministic and LLM-free.

Run via: ``make test-recon-integration`` (spins up compose, executes, tears down).
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Iterable, Optional

import asyncpg
import pytest
import pytest_asyncio

from app.clients.db import ReconDB

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"
LLM_REPLAY_DIR = FIXTURES_DIR / "llm-replays"

_SKIP_REASON = (
    "recon integration tests need RECON_INTEGRATION=1 and a reachable "
    "postgres — use `make test-recon-integration`"
)


def _integration_enabled() -> bool:
    return os.getenv("RECON_INTEGRATION") == "1"


integration_only = pytest.mark.skipif(
    not _integration_enabled(), reason=_SKIP_REASON
)


# ─── Database / seed helpers ──────────────────────────────────────────

def _dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        pytest.skip("DATABASE_URL not set — integration tests require a DB")
    return dsn


@pytest_asyncio.fixture
async def pg_pool() -> AsyncIterator[asyncpg.Pool]:
    pool = await asyncpg.create_pool(_dsn(), min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def recon_db(pg_pool: asyncpg.Pool) -> AsyncIterator[ReconDB]:
    db = ReconDB(_dsn())
    # Reuse our own pool so the test can talk to the same DB as the helper.
    db._pool = pg_pool  # type: ignore[attr-defined]
    yield db


@dataclass
class SeedIds:
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    environment_id: uuid.UUID


async def _seed_core_rows(pool: asyncpg.Pool, *, prefix: str) -> SeedIds:
    """Insert the minimum set of workspace / user / project / environment rows
    needed to satisfy ``recon_scans`` foreign keys. Each call produces a fresh
    set so tests can run in parallel without colliding."""
    unique = uuid.uuid4().hex[:8]
    async with pool.acquire() as conn:
        workspace_id = uuid.uuid4()
        user_id = uuid.uuid4()
        project_id = uuid.uuid4()
        environment_id = uuid.uuid4()

        # users has no workspace_id column on creation — workspaces.owner_id
        # points at users.id so we have to insert the user first with a
        # deferred workspace, then create the workspace referring back.
        await conn.execute(
            "INSERT INTO users (id, email, password_hash, name) "
            "VALUES ($1, $2, $3, $4)",
            user_id,
            f"{prefix}-{unique}@example.com",
            "$2b$12$stub",
            f"{prefix}-user",
        )
        await conn.execute(
            "INSERT INTO workspaces (id, name, owner_id) VALUES ($1, $2, $3)",
            workspace_id,
            f"{prefix}-ws-{unique}",
            user_id,
        )
        await conn.execute(
            "INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, $3)",
            project_id,
            workspace_id,
            f"{prefix}-project-{unique}",
        )
        await conn.execute(
            "INSERT INTO saved_environments (id, workspace_id, name, url) "
            "VALUES ($1, $2, $3, $4)",
            environment_id,
            workspace_id,
            f"{prefix}-env-{unique}",
            "http://juice-shop:3000",
        )
        return SeedIds(workspace_id, user_id, project_id, environment_id)


async def _insert_scan(
    pool: asyncpg.Pool,
    seed: SeedIds,
    *,
    target_url: str,
    status: str = "pending",
) -> str:
    scan_id = uuid.uuid4()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO recon_scans
               (id, workspace_id, project_id, environment_id, target_url,
                status, created_by_user_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            scan_id,
            seed.workspace_id,
            seed.project_id,
            seed.environment_id,
            target_url,
            status,
            seed.user_id,
        )
    return str(scan_id)


async def _insert_authorization(pool: asyncpg.Pool, scan_id: str, seed: SeedIds) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO recon_scan_authorizations
               (scan_id, acknowledged_by_user_id, acknowledged_at,
                justification, caller_ip, user_agent)
               VALUES ($1, $2, now(), $3, $4, $5)""",
            uuid.UUID(scan_id),
            seed.user_id,
            "Integration-test authorization — scope limited to juice-shop target",
            "127.0.0.1",
            "recon-integration-tests/1.0",
        )


@pytest_asyncio.fixture
async def seed(pg_pool: asyncpg.Pool) -> SeedIds:
    return await _seed_core_rows(pg_pool, prefix="recon-it")


@pytest_asyncio.fixture
async def scan_factory(pg_pool: asyncpg.Pool, seed: SeedIds):
    created: list[str] = []

    async def _make(
        *,
        target_url: str = "http://juice-shop:3000",
        status: str = "pending",
        with_authorization: bool = True,
    ) -> str:
        scan_id = await _insert_scan(pg_pool, seed, target_url=target_url, status=status)
        if with_authorization:
            await _insert_authorization(pg_pool, scan_id, seed)
        created.append(scan_id)
        return scan_id

    yield _make

    # Cleanup — cascade deletes via FK on scan_id.
    async with pg_pool.acquire() as conn:
        for scan_id in created:
            await conn.execute(
                "DELETE FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
            )


# ─── LLM replay ───────────────────────────────────────────────────────

class LLMReplayClient:
    """Drop-in stand-in for the async LLM client used by phases.

    Loads a recorded fixture (``tests/fixtures/llm-replays/<name>.json``),
    matches by a stable key derived from the user prompt, and returns the
    pre-baked response. If a call doesn't match any recorded key the client
    raises — so a drifting prompt surface is loud rather than silently
    mocked away.
    """

    def __init__(self, name: str):
        self.name = name
        path = LLM_REPLAY_DIR / f"{name}.json"
        with open(path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        self._entries: list[dict[str, Any]] = raw["entries"]
        self.default: Optional[str] = raw.get("default")
        self.calls: list[tuple[str, Any]] = []

    @staticmethod
    def _match_key(prompt: str) -> str:
        # Match on the first 200 chars so small state diffs don't miss.
        return prompt[:200]

    def _lookup(self, prompt: str) -> str:
        key = self._match_key(prompt)
        for entry in self._entries:
            if entry["match"] in prompt:
                return entry["response"]
        if self.default is not None:
            return self.default
        raise KeyError(
            f"LLMReplayClient[{self.name}] has no recorded response for prompt "
            f"starting {key!r}"
        )

    async def generate(self, user_prompt: str, **_kwargs: Any) -> str:
        self.calls.append(("generate", user_prompt))
        return self._lookup(user_prompt)

    async def generate_with_repo_context(
        self,
        user_prompt: str,
        repo_files: Iterable[tuple[str, str]],
        **_kwargs: Any,
    ) -> str:
        self.calls.append(("generate_with_repo_context", user_prompt))
        return self._lookup(user_prompt)


@pytest.fixture
def llm_replay() -> "Callable[[str], LLMReplayClient]":  # type: ignore[name-defined]
    def _make(name: str) -> LLMReplayClient:
        return LLMReplayClient(name)

    return _make


# ─── External-tool stubs (autouse so real subfinder/nmap/whatweb
# never runs against the bridge network during integration tests). ────

@pytest.fixture(autouse=True)
def stub_external_tools(monkeypatch):
    """Return canned nmap / subfinder / whatweb output keyed by binary name.

    External recon binaries aren't stable enough against a Docker bridge
    address to use live — we pin their output so the fingerprinting phase
    still exercises the parser and artifact write path.
    """
    from app.phases import fingerprinting

    defaults = {
        "nmap": (
            "Starting Nmap 7.94 ( https://nmap.org )\n"
            "Nmap scan report for juice-shop\n"
            "80/tcp open http  Node.js\n"
            "3000/tcp open ppp  Node.js\n"
        ),
        "subfinder": "",
        "whatweb": (
            "http://juice-shop:3000 [200 OK] HTTPServer[Express], "
            "Meta-Generator[vue]\n"
        ),
    }

    async def _fake_run_tool(argv: list[str]) -> str:
        binary = os.path.basename(argv[0])
        return defaults.get(binary, "")

    monkeypatch.setattr(fingerprinting, "RUN_TOOL_FN", _fake_run_tool)
    return defaults


# ─── Billing event capture ────────────────────────────────────────────

@pytest.fixture
def override_phase(monkeypatch):
    """Replace one or more phase-runner functions in a way the orchestrator sees.

    The orchestrator captures ``phase_module.run`` into ``DEFAULT_RUNNERS`` at
    import time, so ``monkeypatch.setattr(phase_module, 'run', ...)`` has no
    effect once ``Orchestrator`` has been constructed. This helper patches the
    ``DEFAULT_RUNNERS`` entry directly so existing ``Orchestrator(db)`` calls
    (without a custom ``runners=`` kwarg) still pick up the override.
    """
    from app import orchestrator as orch_mod
    from app.checkpoint import ReconPhase

    def _override(phase: ReconPhase, runner):
        monkeypatch.setitem(orch_mod.DEFAULT_RUNNERS, phase, runner)

    return _override


@pytest.fixture
def billing_events(monkeypatch):
    """Capture every ``EMIT_BILLING_FN`` call across every phase module."""
    events: list[dict[str, Any]] = []

    async def _capture(workspace_id: str, event_type: str, quantity: int) -> None:
        events.append(
            {
                "workspace_id": workspace_id,
                "event_type": event_type,
                "quantity": quantity,
            }
        )

    from app.phases import (
        discovery,
        exploitation,
        fingerprinting,
        reporting,
        vuln_analysis,
    )

    for mod in (discovery, exploitation, fingerprinting, reporting, vuln_analysis):
        monkeypatch.setattr(mod, "EMIT_BILLING_FN", _capture, raising=False)

    return events


# ─── Phase-runner overrides ───────────────────────────────────────────

@dataclass
class PhaseRunRecorder:
    """Records which phases were invoked and returns a stubbed PhaseResult."""

    invocations: list[str]

    async def __call__(self, ctx) -> Any:  # noqa: ANN001
        from app.phases import PhaseResult
        self.invocations.append("called")
        return PhaseResult(summary="stub")


# ─── Top-level export ────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _skip_non_integration(request):
    """Skip every test in this directory unless the integration harness is up."""
    if not _integration_enabled():
        pytest.skip(_SKIP_REASON)
