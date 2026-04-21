"""Phase 1: Fingerprinting — external + source-code surface scan.

Runs three external tools against the target and walks the connected source
repo (read-only mount) to produce a tech-stack manifest. Output is aggregated
into a ``FingerprintingResult`` JSON artifact and made available to the
discovery phase via ``ctx.state["fingerprint"]``.

All external-tool calls funnel through :data:`RUN_TOOL_FN` so tests can
monkeypatch subprocess execution and assert argv. LLM classification of repo
content goes through :data:`LLM_CLASSIFY_FN`, which in production wraps every
file per ``.claude/skills/exploit-safety/references/prompt-injection-hardening.md``
(see :mod:`app.safety`).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Iterable, Optional
from urllib.parse import urlparse

from app.safety import _cap_bytes, _sanitize_file_content, build_safe_messages

from .context import PhaseContext, PhaseResult

logger = logging.getLogger(__name__)


# ─── Seams (default no-ops; real wiring injects production fns) ──────

RunToolFn = Callable[[list[str]], Awaitable[str]]
PersistArtifactFn = Callable[[str, str, str, dict], Awaitable[Optional[str]]]
EmitBillingFn = Callable[[str, str, int], Awaitable[None]]
LLMClassifyFn = Callable[[Iterable[tuple[str, str]], str], Awaitable[str]]


async def _default_run_tool(argv: list[str]) -> str:
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return stdout.decode("utf-8", errors="replace")


async def _default_persist_artifact(
    scan_id: str, phase: str, kind: str, payload: dict
) -> Optional[str]:
    del scan_id, phase, kind, payload
    return None


async def _default_emit_billing(workspace_id: str, event_type: str, quantity: int) -> None:
    del workspace_id, event_type, quantity
    return None


async def _default_llm_classify(
    files: Iterable[tuple[str, str]], user_prompt: str
) -> str:
    # Safety: still build the wrapped message so tests can assert the wrapper
    # was consulted. In production the real LLM client is injected.
    build_safe_messages(files, user_prompt)
    return "{}"


RUN_TOOL_FN: RunToolFn = _default_run_tool
PERSIST_ARTIFACT_FN: PersistArtifactFn = _default_persist_artifact
EMIT_BILLING_FN: EmitBillingFn = _default_emit_billing
LLM_CLASSIFY_FN: LLMClassifyFn = _default_llm_classify


# ─── Data shape ─────────────────────────────────────────────────────

@dataclass
class FingerprintingResult:
    target_url: str
    host: str
    ports: list[dict] = field(default_factory=list)
    subdomains: list[str] = field(default_factory=list)
    technologies: list[str] = field(default_factory=list)
    source_stack: dict = field(default_factory=dict)


# ─── External tool wrappers ─────────────────────────────────────────

async def _nmap(host: str) -> list[dict]:
    argv = ["nmap", "-sV", "--top-ports", "100", host]
    stdout = await RUN_TOOL_FN(argv)
    return _parse_nmap(stdout)


async def _subfinder(domain: str) -> list[str]:
    argv = ["subfinder", "-d", domain, "-silent"]
    stdout = await RUN_TOOL_FN(argv)
    return [line.strip() for line in stdout.splitlines() if line.strip()]


async def _whatweb(url: str) -> list[str]:
    argv = ["whatweb", "-a", "3", url]
    stdout = await RUN_TOOL_FN(argv)
    return _parse_whatweb(stdout)


def _parse_nmap(stdout: str) -> list[dict]:
    ports: list[dict] = []
    for line in stdout.splitlines():
        stripped = line.strip()
        if "/tcp" not in stripped and "/udp" not in stripped:
            continue
        parts = stripped.split()
        if len(parts) < 3:
            continue
        proto_port, state, *service_parts = parts
        try:
            port_num, proto = proto_port.split("/")
        except ValueError:
            continue
        ports.append(
            {
                "port": int(port_num) if port_num.isdigit() else None,
                "protocol": proto,
                "state": state,
                "service": " ".join(service_parts),
            }
        )
    return ports


def _parse_whatweb(stdout: str) -> list[str]:
    # whatweb emits "URL [status] PluginA[detail], PluginB[detail], ...".
    # Strip the leading URL + bracketed-status tokens, then take each comma
    # chunk and drop its [detail] suffix.
    techs: list[str] = []
    for line in stdout.splitlines():
        remainder = line.strip()
        while remainder:
            head = remainder.split(None, 1)
            if "://" in head[0]:
                remainder = head[1].lstrip() if len(head) > 1 else ""
                continue
            if remainder.startswith("["):
                close = remainder.find("]")
                if close == -1:
                    remainder = ""
                    break
                remainder = remainder[close + 1 :].lstrip()
                continue
            break
        for chunk in remainder.split(","):
            name = chunk.split("[", 1)[0].strip()
            if name and name not in techs:
                techs.append(name)
    return techs


# ─── Source-code surface scan ───────────────────────────────────────

SOURCE_SCAN_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".py", ".ts", ".tsx", ".js", ".jsx", ".json",
        ".toml", ".yaml", ".yml", ".lock", ".cfg", ".ini",
        ".go", ".rb", ".java", ".kt", ".rs", ".php",
    }
)

SOURCE_SCAN_FILENAMES: frozenset[str] = frozenset(
    {
        "package.json", "requirements.txt", "pyproject.toml",
        "Pipfile", "Pipfile.lock", "poetry.lock", "yarn.lock",
        "pnpm-lock.yaml", "package-lock.json", "Gemfile", "go.mod",
        "Cargo.toml", "composer.json", "build.gradle", "pom.xml",
    }
)

IGNORED_DIRS: frozenset[str] = frozenset(
    {"node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv", ".next"}
)

SOURCE_CLASSIFY_PROMPT = (
    "Classify this project's tech stack based on the provided file contents. "
    "Return a JSON object with exactly these keys: "
    '"framework", "package_manager", "orm", "auth_library". '
    "Use null for any field you cannot determine with confidence. "
    "Respond with JSON only, no prose."
)


def _iter_repo_files(repo_path: str, *, max_bytes: int) -> Iterable[tuple[str, str]]:
    """Yield ``(relative_path, sanitized_capped_content)`` pairs for scannable files.

    Files larger than ``max_bytes`` are truncated with a ``[... truncated ...]``
    marker (per recon-safety rule 4 / exploit-safety prompt-injection hardening).
    """
    root = Path(repo_path)
    if not root.exists() or not root.is_dir():
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS and not d.startswith(".")]
        for name in filenames:
            suffix = Path(name).suffix
            if suffix not in SOURCE_SCAN_EXTENSIONS and name not in SOURCE_SCAN_FILENAMES:
                continue
            full = Path(dirpath) / name
            try:
                content = full.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            rel = str(full.relative_to(root))
            yield rel, _cap_bytes(_sanitize_file_content(content), max_bytes)


async def _scan_source_code(repo_path: str) -> dict:
    from app.safety import MAX_FILE_BYTES

    files = list(_iter_repo_files(repo_path, max_bytes=MAX_FILE_BYTES))
    empty = {"framework": None, "package_manager": None, "orm": None, "auth_library": None}
    if not files:
        return empty
    try:
        raw = await LLM_CLASSIFY_FN(files, SOURCE_CLASSIFY_PROMPT)
    except Exception as e:  # noqa: BLE001 — classifier failures degrade gracefully
        logger.warning("source-code classification failed: %s", e)
        return empty
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return empty
    return {k: parsed.get(k) for k in empty}


# ─── Phase entry point ──────────────────────────────────────────────

def _host_of(target_url: str) -> str:
    parsed = urlparse(target_url)
    return parsed.hostname or target_url


async def run(ctx: PhaseContext) -> PhaseResult:
    host = _host_of(ctx.target_url)

    ports_task = asyncio.create_task(_nmap(host))
    subs_task = asyncio.create_task(_subfinder(host))
    whatweb_task = asyncio.create_task(_whatweb(ctx.target_url))

    ports, subdomains, technologies = await asyncio.gather(
        ports_task, subs_task, whatweb_task
    )

    repo_path = ctx.state.get("repo_path")
    source_stack: dict[str, Any] = {}
    if repo_path:
        source_stack = await _scan_source_code(str(repo_path))

    result = FingerprintingResult(
        target_url=ctx.target_url,
        host=host,
        ports=ports,
        subdomains=subdomains,
        technologies=technologies,
        source_stack=source_stack,
    )
    payload = asdict(result)
    ctx.state["fingerprint"] = payload

    artifact_id = await PERSIST_ARTIFACT_FN(ctx.scan_id, "fingerprinting", "json", payload)

    if not ctx.state.get("suppress_per_phase_billing"):
        await EMIT_BILLING_FN(ctx.workspace_id, "recon_phase_fingerprinting", 1)

    return PhaseResult(
        artifact_id=artifact_id,
        summary=(
            f"fingerprint gathered for {ctx.target_url}: "
            f"{len(ports)} ports, {len(subdomains)} subdomains, "
            f"{len(technologies)} technologies"
        ),
    )
