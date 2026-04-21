"""FastAPI entry point for the recon-executor service.

Architectural pattern (matches services/qa-loop-executor):
  * Sync HTTP entry — client POSTs a session-start request, we return 202
    immediately after spawning an ``asyncio.create_task`` for the orchestrator.
  * DB-status checkpointing — all durability lives in the ``recon_scans`` and
    ``recon_scan_phases`` tables. No Temporal, no in-memory scheduler state.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from app.clients.db import ReconDB
from app.clients.gateway import get_platform_config
from app.orchestrator import Orchestrator

load_dotenv()

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Recon Executor",
    description="Runs the 5-phase Recon pipeline for whynot",
    version="1.0.0",
)

_db: Optional[ReconDB] = None


def _get_db() -> ReconDB:
    global _db
    if _db is None:
        _db = ReconDB.from_env()
    return _db


@app.on_event("startup")
async def _on_startup() -> None:
    try:
        db = _get_db()
        await db.connect()
    except Exception as e:  # noqa: BLE001 - log and keep going; /health will reflect DB loss
        logger.error("DB init failed at startup: %s", e)

    # Warm the platform-config cache in the background so the first scan
    # doesn't pay the RTT. Errors are swallowed — the call will retry lazily.
    async def _warm_config() -> None:
        try:
            await get_platform_config()
        except Exception as e:  # noqa: BLE001
            logger.warning("Platform config prefetch failed: %s", e)

    asyncio.create_task(_warm_config())


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    if _db is not None:
        await _db.close()


@app.get("/health")
async def health() -> dict:
    return {"status": "healthy", "service": "recon-executor"}


@app.get("/")
async def root() -> dict:
    return {
        "service": "Recon Executor",
        "version": "1.0.0",
        "endpoints": {"health": "/health", "start_session": "/api/recon/sessions"},
    }


class StartSessionRequest(BaseModel):
    scan_id: str = Field(..., description="UUID of an existing recon_scans row with status='pending'")


class StartSessionResponse(BaseModel):
    scan_id: str
    accepted: bool = True


@app.post(
    "/api/recon/sessions",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=StartSessionResponse,
)
async def start_session(req: StartSessionRequest) -> StartSessionResponse:
    db = _get_db()
    scan = await db.get_scan(req.scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="errors:recon.executor.scan_not_found")
    if scan["status"] != "pending":
        raise HTTPException(status_code=409, detail="errors:recon.executor.scan_not_pending")

    orchestrator = Orchestrator(db)

    async def _run() -> None:
        try:
            await orchestrator.run_scan(req.scan_id)
        except Exception as e:  # noqa: BLE001 - top-level guard of the detached task
            logger.exception("Unhandled orchestrator error for scan %s", req.scan_id)
            try:
                await db.set_scan_status(req.scan_id, "failed", error_message=str(e))
            except Exception:  # noqa: BLE001
                pass

    asyncio.create_task(_run())
    return StartSessionResponse(scan_id=req.scan_id, accepted=True)
