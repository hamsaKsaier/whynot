"""Unit tests for the discovery phase (phase 2).

Covers:
  - Crawler stops at depth 3 even when more in-scope links are found.
  - Crawler stays within the original origin (no cross-domain follow).
  - Authenticated crawl drives the login flow and NEVER logs the password.
  - JS-bundle parsing extracts fetch / axios / XHR.open endpoints.
  - OpenAPI pull merges endpoints when a spec is returned.
  - LLM correlation routes through the prompt-injection wrapper and produces
    a dict with the canonical category set.
  - Phase persists a JSON artifact and emits PAYG billing by default.
  - Per-phase billing suppressed when the orchestrator sets the flag.
  - Cancellation between phases: when the orchestrator detects cancellation
    between fingerprinting and discovery, discovery.run() never executes.
"""

from __future__ import annotations

import json
import logging

import pytest

from app.orchestrator import Orchestrator, OrchestratorClocks, PhaseRunner
from app.checkpoint import ReconPhase
from app.phases import PhaseContext, PhaseResult
from app.phases import discovery as dis


@pytest.fixture
def ctx() -> PhaseContext:
    return PhaseContext(
        scan_id="scan-abc",
        workspace_id="ws-1",
        target_url="https://app.example.com/",
    )


# ─── Crawler depth / scope ──────────────────────────────────────────


def _linked_pages(graph: dict[str, dict]):
    async def fake_fetch(url: str, auth_session):
        del auth_session
        return graph.get(url, {"links": [], "forms": [], "js_bundles": []})

    return fake_fetch


@pytest.mark.asyncio
async def test_crawl_stops_at_depth_3(monkeypatch):
    # Chain of 5 pages linked in a line. Depth 0..4 would be needed to reach
    # page 4 — depth 3 must stop after visiting p0..p3.
    pages = {
        "https://t.test/0": {"links": ["https://t.test/1"]},
        "https://t.test/1": {"links": ["https://t.test/2"]},
        "https://t.test/2": {"links": ["https://t.test/3"]},
        "https://t.test/3": {"links": ["https://t.test/4"]},
        "https://t.test/4": {"links": ["https://t.test/5"]},
        "https://t.test/5": {"links": []},
    }
    monkeypatch.setattr(dis, "FETCH_PAGE_FN", _linked_pages(pages))

    out = await dis._crawl("https://t.test/0")
    assert "https://t.test/3" in out["urls"]
    assert "https://t.test/4" not in out["urls"]
    assert "https://t.test/5" not in out["urls"]


@pytest.mark.asyncio
async def test_crawl_skips_cross_origin_links(monkeypatch):
    pages = {
        "https://t.test/": {"links": ["https://evil.test/x", "/inside"]},
        "https://t.test/inside": {"links": []},
    }
    monkeypatch.setattr(dis, "FETCH_PAGE_FN", _linked_pages(pages))
    out = await dis._crawl("https://t.test/")
    assert "https://t.test/inside" in out["urls"]
    assert "https://evil.test/x" not in out["urls"]


@pytest.mark.asyncio
async def test_crawl_deduplicates_revisits(monkeypatch):
    # Two pages pointing at each other — must not loop forever.
    pages = {
        "https://t.test/a": {"links": ["https://t.test/b"]},
        "https://t.test/b": {"links": ["https://t.test/a"]},
    }
    monkeypatch.setattr(dis, "FETCH_PAGE_FN", _linked_pages(pages))
    out = await dis._crawl("https://t.test/a")
    assert sorted(out["urls"]) == ["https://t.test/a", "https://t.test/b"]


@pytest.mark.asyncio
async def test_crawl_skips_duplicate_queue_entries(monkeypatch):
    # /start links to /a and /b; /a also links to /b. /b is pushed twice but
    # should only be fetched once — the second pop must hit the in-visited
    # early-continue branch.
    fetch_log: list[str] = []
    pages = {
        "https://t.test/start": {"links": ["https://t.test/a", "https://t.test/b"]},
        "https://t.test/a": {"links": ["https://t.test/b"]},
        "https://t.test/b": {"links": []},
    }

    async def logging_fetch(url: str, auth_session):
        del auth_session
        fetch_log.append(url)
        return pages.get(url, {"links": [], "forms": [], "js_bundles": []})

    monkeypatch.setattr(dis, "FETCH_PAGE_FN", logging_fetch)
    await dis._crawl("https://t.test/start")
    assert fetch_log.count("https://t.test/b") == 1


@pytest.mark.asyncio
async def test_crawl_captures_forms_and_bundles(monkeypatch):
    pages = {
        "https://t.test/": {
            "links": ["/login"],
            "forms": [{"action": "/login", "method": "post"}],
            "js_bundles": ["https://t.test/static/app.js"],
        },
        "https://t.test/login": {
            "links": [],
            "forms": [{"action": "/do-login", "method": "post"}],
            "js_bundles": ["https://t.test/static/app.js"],  # dedupe by set
        },
    }
    monkeypatch.setattr(dis, "FETCH_PAGE_FN", _linked_pages(pages))
    out = await dis._crawl("https://t.test/")
    assert len(out["forms"]) == 2
    assert out["js_bundles"] == ["https://t.test/static/app.js"]


# ─── Authenticated crawl + password redaction ───────────────────────


def test_redact_login_flow_masks_sensitive_keys():
    redacted = dis._redact_login_flow(
        {"username": "alice", "password": "hunter2", "token": "abc"}
    )
    assert redacted["username"] == "alice"
    assert redacted["password"] == "[REDACTED]"
    assert redacted["token"] == "[REDACTED]"


@pytest.mark.asyncio
async def test_authenticate_never_logs_password(caplog):
    with caplog.at_level(logging.INFO, logger="app.phases.discovery"):
        await dis._authenticate({"username": "alice", "password": "s3cr3t-DO-NOT-LOG"})

    joined = " ".join(rec.getMessage() for rec in caplog.records)
    assert "s3cr3t-DO-NOT-LOG" not in joined
    assert "[REDACTED]" in joined


@pytest.mark.asyncio
async def test_run_with_login_flow_drives_authentication(monkeypatch, ctx, caplog):
    async def fetch(url, auth_session):
        # The crawler must receive the auth session returned by _authenticate.
        assert auth_session is not None
        return {"links": [], "forms": [], "js_bundles": []}

    monkeypatch.setattr(dis, "FETCH_PAGE_FN", fetch)
    ctx.state["login_flow"] = {"username": "alice", "password": "never-log-me"}

    with caplog.at_level(logging.INFO, logger="app.phases.discovery"):
        await dis.run(ctx)

    assert ctx.state["attack_surface"]["authenticated"] is True
    joined = " ".join(rec.getMessage() for rec in caplog.records)
    assert "never-log-me" not in joined


# ─── JS-bundle parser ───────────────────────────────────────────────


def test_extract_fetch_axios_xhr():
    src = """
        const a = fetch('/api/me');
        axios.get("/api/v1/orders");
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/logout');
        const ignore = fetchSomething('/not-a-fetch-call');
    """
    eps = dis._extract_endpoints_from_js(src)
    assert "/api/me" in eps
    assert "/api/v1/orders" in eps
    assert "/api/v1/logout" in eps
    assert "/not-a-fetch-call" not in eps


def test_extract_endpoints_dedupes():
    src = "fetch('/a'); fetch('/a'); axios.get('/a');"
    assert dis._extract_endpoints_from_js(src) == ["/a"]


@pytest.mark.asyncio
async def test_collect_js_endpoints(monkeypatch):
    async def fetch(url, auth_session):
        del auth_session
        if url.endswith("/app.js"):
            return {"body": "fetch('/api/a'); axios.post('/api/b');"}
        return {"body": ""}

    monkeypatch.setattr(dis, "FETCH_PAGE_FN", fetch)
    out = await dis._collect_js_endpoints(["https://t.test/app.js"])
    assert sorted(out) == ["/api/a", "/api/b"]


# ─── OpenAPI integration ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_merges_openapi_endpoints(monkeypatch, ctx):
    async def fetch(url, auth_session):
        del auth_session
        return {"links": [], "forms": [], "js_bundles": []}

    async def fetch_spec(host):
        assert host == "app.example.com"
        return {
            "paths": {
                "/api/users": {"get": {}, "post": {}},
                "/api/users/{id}": {"delete": {}},
            }
        }

    async def no_cat(files, prompt):
        return json.dumps({c: [] for c in dis.CATEGORIES})

    monkeypatch.setattr(dis, "FETCH_PAGE_FN", fetch)
    monkeypatch.setattr(dis, "FETCH_OPENAPI_FN", fetch_spec)
    monkeypatch.setattr(dis, "LLM_CORRELATE_FN", no_cat)

    await dis.run(ctx)
    surface = ctx.state["attack_surface"]
    methods_paths = {(e["method"], e["path"]) for e in surface["openapi_endpoints"]}
    assert ("GET", "/api/users") in methods_paths
    assert ("POST", "/api/users") in methods_paths
    assert ("DELETE", "/api/users/{id}") in methods_paths


# ─── LLM correlation ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_correlate_returns_canonical_categories(monkeypatch):
    async def fake_correlate(files, prompt):
        # Return only two categories; missing ones must be filled with [].
        return json.dumps(
            {"auth": ["/login"], "data_mutation": ["/api/create"]}
        )

    monkeypatch.setattr(dis, "LLM_CORRELATE_FN", fake_correlate)
    out = await dis._correlate({"technologies": ["nginx"]}, ["/login", "/api/create"])
    assert set(out.keys()) == set(dis.CATEGORIES)
    assert out["auth"] == ["/login"]
    assert out["data_mutation"] == ["/api/create"]
    assert out["file_upload"] == []


@pytest.mark.asyncio
async def test_correlate_empty_endpoints_returns_empty_categories(monkeypatch):
    async def boom(files, prompt):
        raise AssertionError("should not call LLM for empty endpoints")

    monkeypatch.setattr(dis, "LLM_CORRELATE_FN", boom)
    out = await dis._correlate({}, [])
    assert all(out[c] == [] for c in dis.CATEGORIES)


@pytest.mark.asyncio
async def test_correlate_bad_json_is_graceful(monkeypatch):
    async def bad(files, prompt):
        return "totally not json"

    monkeypatch.setattr(dis, "LLM_CORRELATE_FN", bad)
    out = await dis._correlate({}, ["/api/x"])
    assert all(out[c] == [] for c in dis.CATEGORIES)


@pytest.mark.asyncio
async def test_correlate_exception_is_graceful(monkeypatch):
    async def boom(files, prompt):
        raise RuntimeError("llm 500")

    monkeypatch.setattr(dis, "LLM_CORRELATE_FN", boom)
    out = await dis._correlate({}, ["/api/x"])
    assert all(out[c] == [] for c in dis.CATEGORIES)


# ─── Phase run() ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_populates_state_persists_and_bills(monkeypatch, ctx):
    pages = {
        "https://app.example.com/": {
            "links": ["/users"],
            "forms": [{"action": "/login", "method": "post"}],
            "js_bundles": ["https://app.example.com/app.js"],
        },
        "https://app.example.com/users": {
            "links": [],
            "forms": [],
            "js_bundles": [],
        },
        "https://app.example.com/app.js": {
            "body": "fetch('/api/users');",
        },
    }
    monkeypatch.setattr(dis, "FETCH_PAGE_FN", _linked_pages(pages))

    async def no_openapi(host):
        del host
        return None

    async def categorize(files, prompt):
        return json.dumps(
            {
                "auth": ["/login"],
                "data_mutation": [],
                "file_upload": [],
                "redirect": [],
                "other": ["/api/users"],
            }
        )

    persisted: list[tuple] = []
    emitted: list[tuple] = []

    async def persist(scan_id, phase, kind, payload):
        persisted.append((scan_id, phase, kind))
        return "art-2"

    async def emit(ws, ev, qty):
        emitted.append((ws, ev, qty))

    monkeypatch.setattr(dis, "FETCH_OPENAPI_FN", no_openapi)
    monkeypatch.setattr(dis, "LLM_CORRELATE_FN", categorize)
    monkeypatch.setattr(dis, "PERSIST_ARTIFACT_FN", persist)
    monkeypatch.setattr(dis, "EMIT_BILLING_FN", emit)

    # Override FETCH_PAGE_FN to also serve bundle bodies.
    async def fetch_mixed(url, auth_session):
        del auth_session
        page = pages.get(url, {"links": [], "forms": [], "js_bundles": []})
        return page

    monkeypatch.setattr(dis, "FETCH_PAGE_FN", fetch_mixed)

    result = await dis.run(ctx)

    surface = ctx.state["attack_surface"]
    assert surface["target_url"] == "https://app.example.com/"
    assert surface["authenticated"] is False
    assert "/api/users" in surface["js_endpoints"]
    assert "/api/users" in surface["endpoints"]
    assert surface["categorized_endpoints"]["auth"] == ["/login"]

    assert result.artifact_id == "art-2"
    assert persisted and persisted[0][1] == "discovery" and persisted[0][2] == "json"
    assert emitted == [("ws-1", "recon_phase_discovery", 1)]


@pytest.mark.asyncio
async def test_run_suppresses_billing_when_flag_set(monkeypatch, ctx):
    async def fetch(url, auth_session):
        del auth_session
        return {"links": [], "forms": [], "js_bundles": []}

    emitted: list[tuple] = []

    async def emit(ws, ev, qty):
        emitted.append((ws, ev, qty))

    monkeypatch.setattr(dis, "FETCH_PAGE_FN", fetch)
    monkeypatch.setattr(dis, "EMIT_BILLING_FN", emit)
    ctx.state["suppress_per_phase_billing"] = True

    await dis.run(ctx)
    assert emitted == []


# ─── Defaults ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_defaults_noop():
    assert await dis._default_fetch_page("https://x", None) == {
        "url": "https://x",
        "links": [],
        "forms": [],
        "js_bundles": [],
    }
    assert await dis._default_fetch_openapi("any") is None
    assert await dis._default_llm_correlate([("a.py", "x=1")], "p") == "{}"
    assert await dis._default_persist_artifact("s", "p", "k", {}) is None
    assert await dis._default_emit_billing("ws", "e", 1) is None


def test_same_origin_treats_relative_as_in_scope():
    assert dis._same_origin("/inside", "https://t.test/") is True
    assert dis._same_origin("https://t.test/x", "https://t.test/") is True
    assert dis._same_origin("https://other/x", "https://t.test/") is False


# ─── Cancellation between fingerprinting and discovery ──────────────


@pytest.mark.asyncio
async def test_cancellation_between_phases_skips_discovery(fake_db, monkeypatch):
    """When cancel_requested_at is set after fingerprinting completes, the
    orchestrator must NOT invoke discovery.run().
    """
    fake_db.store.scans["s1"] = {
        "id": "s1",
        "workspace_id": "ws-1",
        "target_url": "https://app.example.com/",
        "status": "pending",
    }

    discovery_called = {"n": 0}

    async def fake_fingerprinting(c):
        # Simulate user clicking "Cancel" while phase 1 is running.
        fake_db.store.scans["s1"]["cancel_requested_at"] = "2026-01-01T00:00:00Z"
        return PhaseResult()

    async def fake_discovery(c):
        discovery_called["n"] += 1
        return PhaseResult()

    async def noop(c):
        return PhaseResult()

    runners: dict[ReconPhase, PhaseRunner] = {
        ReconPhase.FINGERPRINTING: fake_fingerprinting,
        ReconPhase.DISCOVERY: fake_discovery,
        ReconPhase.VULN_ANALYSIS: noop,
        ReconPhase.EXPLOITATION: noop,
        ReconPhase.REPORTING: noop,
    }
    orch = Orchestrator(
        fake_db,
        runners=runners,
        clocks=OrchestratorClocks(heartbeat=0.01, cancel_poll=0.01),
    )
    await orch.run_scan("s1")

    assert discovery_called["n"] == 0
    assert fake_db.store.scans["s1"]["status"] == "cancelled"

    # The discovery phase row was never STARTED — at most it was marked
    # "skipped" by the orchestrator's skip-remaining step. It must NOT be
    # "running" or "completed".
    discovery_row = fake_db.store.phases.get(("s1", "discovery"))
    if discovery_row is not None:
        assert discovery_row["status"] in {"skipped", "pending"}
