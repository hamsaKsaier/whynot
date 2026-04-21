#!/usr/bin/env python3
"""
Prompt Executor
Sequentially executes all .md prompts in a target folder using either
Claude Code CLI (claude -p) or OpenCode CLI (opencode run), auto-detected
from the --model argument.

Execution modes (four top-level CLI verbs + doctor):

    run        — foreground, one-shot. Exits when the folder is done.
    start      — background daemon, one-shot. Same as run but daemonized.
    schedule   — one-shot fire at a future wall-clock time (--at) or
                 relative offset (--in 2h30m). Jobs persist across reboots
                 in the shared job store and are owned by the
                 scheduler-daemon process.
    cron       — recurring fire on a standard 5-field cron expression
                 ("m h dom mon dow", e.g. "0 9 * * 1-5"). Also persisted
                 in the job store and driven by the scheduler-daemon.
    doctor     — non-destructive log analyzer. Parses the existing .log
                 and _failures.log files, classifies each failure into a
                 category (MCP_ERROR / SKILL_ERROR / RATE_LIMIT / QUOTA /
                 TIMEOUT / EXTERNAL / UNRECOVERABLE / TRANSIENT), and
                 writes a markdown fix-plan next to the logs with a
                 per-prompt recommendation. Never edits prompts or this
                 script — it is advisory only.

How schedule / cron work:

    `schedule` and `cron add` write a job record into
    prompt-executor/.prompt_executor_jobs.json and, if the
    scheduler-daemon is not already running, auto-spawn it (same double
    fork + PID file + fsync log pattern as `start`). The scheduler-daemon
    wakes every minute, computes the next-fire time for every job, and
    when a job is due it `subprocess.Popen`s
    `prompt_executor.py run <folder> ...` — reusing every existing retry,
    logging, and _done-tracking code path. One-shot schedules are removed
    from the store after firing; cron jobs update last_run_iso /
    next_run_iso in place and stay scheduled forever.

    The scheduler itself has its own PID/log pair keyed as "scheduler":
    .prompt_executor_scheduler.pid and .prompt_executor_scheduler.log.
    It survives crashes via resilient_run-style restart (MAX_CRASHES=5).
    `stop` with no args and no --*-only flag kills the scheduler too.

How the stop argument works:

    `stop <folder>`                 — legacy behaviour, stops exactly one
                                      running instance by folder slug.
                                      Prompts for confirmation if that
                                      folder is also in schedule/cron.
    `stop` (no folder)              — prints a plan of every running
                                      instance + every scheduled job +
                                      every cron job, then prompts
                                      "Stop N running + disable M
                                      scheduled + disable K cron? [y/N]".
                                      Only proceeds on "y".
    `stop --yes`                    — same plan, no prompt, proceed
                                      immediately. Safe for scripts.
    `stop --running-only`           — only kills PIDs, leaves
                                      schedule/cron jobs intact.
    `stop --scheduled-only`         — only removes one-shot schedule
                                      jobs, leaves running PIDs and
                                      crons intact.
    `stop --cron-only`              — only removes recurring cron jobs.
    All --*-only flags can be combined with --yes.

Self-healing via `doctor`:

    doctor is intentionally conservative. It classifies but does not
    auto-edit. That preserves the 100%-coverage + immutable-executor
    invariants the repo relies on. Recommended workflow:
        1. `stop` to halt execution
        2. `doctor` to produce a fix plan
        3. Read the generated .prompt_executor_{slug}_fixplan.md
        4. Apply the recommendations by hand (increase --retry-wait,
           switch model, fix MCP server, etc.)
        5. `run` or `schedule` / `cron` again

Backend selection:
    Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code CLI
    All other models (glm-*, zai/*, etc.)           → OpenCode CLI

Backend selection:
    Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code CLI
    All other models (glm-*, zai/*, etc.)           → OpenCode CLI

Model alias conventions:
    Claude backend:
        opus, sonnet, haiku          → claude-opus-4-7[1m], etc.
        opus-200k, sonnet-200k       → claude-opus-4-7, etc. (200k context)
    OpenCode backend (zai/ prefix required):
        glm-5.1                      → zai/glm-5.1  (default GLM)
        glm-5                        → zai/glm-5
        glm-5-turbo                  → zai/glm-5-turbo
        glm-4.7                      → zai/glm-4.7
        glm-4.7-flash / flash        → zai/glm-4.7-flash
        glm                          → zai/glm-5.1

OpenCode command construction (_build_opencode_cmd):
    - Builds: opencode run --model <resolved> [flags] [prompt]
    - --agent <name>: selects a primary agent from .opencode/agent/*.md
    - --continue: resumes the last session
    - --dangerously-skip-permissions: auto-approves tool calls (non-interactive)
    - --file <path>: attaches a file to the message
    - Prompts <= 32KB: passed as positional argument
    - Prompts > 32KB: piped via stdin (OpenCode reads stdin when not a TTY)

Environment variable requirements:
    - ZAI_API_KEY: Required for Z.AI GLM models (glm-*, zai/*). Missing key
      produces a warning (not fatal — alternative auth may be configured).
    - ANTHROPIC_API_KEY: Required for Claude backend (opus, sonnet, haiku).
    - OPENCODE_CONFIG: When set, passed through to the OpenCode subprocess,
      allowing a non-default config file path (e.g., for CI environments).

Working directory (--working-dir):
    By default, prompts run from the project root (where .opencode/
    lives). Use --working-dir to override when running from a non-project
    directory. The executor verifies .opencode/opencode.jsonc is discoverable
    from the working directory and warns if it is not — MCP servers and
    custom skills will not load without a valid config.

MCP/skill error classification:
    When a subprocess exits non-zero, the executor scans stderr for known
    error patterns and logs a classification label:
    - MCP_ERROR: MCP server failures, timeouts, auth issues, unreachable hosts
    - SKILL_ERROR: Skill not found, validation failures, permission denied
    These labels appear in the log as "CLASSIFIED: MCP_ERROR" etc. and help
    diagnose whether a failure is infrastructure (MCP) vs prompt (skill).

Features:
- Required --model argument (determines which CLI backend to use)
- Required folder argument (relative to project root or absolute)
- Recursive nested folder support (depth-first, sorted by name)
- Skip files/folders ending with _done
- Rename completed files -> _done.md, completed folders -> _done
- Retry with exponential backoff on timeout/error (default: 3 retries)
- Skip-and-continue when retries exhausted (never stops on retryable failures)
- Auto-restart on crash (up to 5 crashes before giving up)
- Daemon stderr -> log file (Python tracebacks are never lost)
- atexit + sys.excepthook crash handlers
- Heartbeat logging during sleep
- Stale PID cleanup on startup
- os.fsync on every log write

Usage:
    python3 prompt-executor/prompt_executor.py start - --model opus --period 1 --max-retries 30 --retry-wait 1
    python3 prompt-executor/prompt_executor.py run   <folder> --model <model> [--period MINUTES] [--max-retries N] [--retry-wait MINUTES]
    python3 prompt-executor/prompt_executor.py stop  [<folder>] [--yes] [--running-only] [--scheduled-only] [--cron-only]
    python3 prompt-executor/prompt_executor.py status [<folder>]

    python3 prompt-executor/prompt_executor.py schedule <folder> --at "2026-04-17 09:00" --model <model>
    python3 prompt-executor/prompt_executor.py schedule <folder> --in 2h30m --model <model>
    python3 prompt-executor/prompt_executor.py schedule list
    python3 prompt-executor/prompt_executor.py schedule remove <job-id>

    python3 prompt-executor/prompt_executor.py cron <folder> --expr "0 9 * * 1-5" --model <model>
    python3 prompt-executor/prompt_executor.py cron list
    python3 prompt-executor/prompt_executor.py cron remove <job-id>

    python3 prompt-executor/prompt_executor.py doctor [<folder>]

Parallel execution:
    Multiple instances can run simultaneously on different folders.
    Each instance gets its own PID file, log file, and failures log,
    keyed by the target folder name (e.g., .prompt_executor_blog-system.pid).

Examples:
    # Execute with Claude Code (Anthropic models)
    python3 prompt_executor.py run prompts/blog-system --model opus
    python3 prompt_executor.py run prompts/blog-system --model sonnet

    # Execute with OpenCode (GLM models)
    python3 prompt_executor.py run prompts/blog-system --model glm-5.1
    python3 prompt_executor.py run prompts/blog-system --model flash

    # Run with custom working directory (when .opencode/ is elsewhere)
    python3 prompt_executor.py run prompts/blog-system --model glm-5.1 --working-dir /path/to/project

    # Run parallel instances with different backends
    python3 prompt_executor.py start prompts/fire-and-forget --model opus --period 5
    python3 prompt_executor.py start prompts/blog-system --model glm-5.1 --period 5

    # Check all running instances
    python3 prompt_executor.py status

    # Stop all instances
    python3 prompt_executor.py stop

    # Stop a specific instance
    python3 prompt_executor.py stop prompts/blog-system

    # Schedule a one-shot run at a specific time
    python3 prompt_executor.py schedule prompts/blog-system --at "2026-04-17 09:00" -m opus

    # Schedule a one-shot run 90 seconds from now
    python3 prompt_executor.py schedule prompts/blog-system --in 90s -m flash

    # List all scheduled jobs
    python3 prompt_executor.py schedule list

    # Remove a scheduled job by ID
    python3 prompt_executor.py schedule remove sch_01HZ...

    # Recurring cron: every weekday at 09:00
    python3 prompt_executor.py cron prompts/blog-system --expr "0 9 * * 1-5" -m sonnet

    # Recurring cron: every minute (smoke test)
    python3 prompt_executor.py cron prompts/blog-system --expr "* * * * *" -m flash

    # Stop everything (prompts for confirmation)
    python3 prompt_executor.py stop

    # Stop everything without confirmation (CI-safe)
    python3 prompt_executor.py stop --yes

    # Only remove scheduled jobs; leave running daemons + crons alone
    python3 prompt_executor.py stop --scheduled-only --yes

    # Analyze logs and produce a fix plan
    python3 prompt_executor.py doctor prompts/blog-system
"""

import argparse
import atexit
import json
import os
import re
import secrets
import signal
import subprocess
import sys
import time
import traceback as tb_module
from collections import namedtuple
from datetime import datetime, timedelta
from pathlib import Path

# ── Path Configuration ──────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent  # prompt-executor/
PROJECT_ROOT = SCRIPT_DIR.parent  # serverlessbase-v2/


# ── Dotenv Loading ──────────────────────────────────────────────────────────
#
# ServerlessBase policy: root `.env` is the single source of truth for all
# environment variables (see .claude/rules/environment-variables.md). The
# executor spawns Claude/OpenCode subprocesses that need provider API keys
# like ZAI_API_KEY — without loading .env, subprocesses inherit only the
# shell env and authentication fails silently (opencode reports
# "Authentication parameter not received in Header").
#
# This is a minimal dependency-free parser: KEY=VALUE lines, optional quotes,
# skips comments and blank lines, leaves existing os.environ values untouched
# so shell overrides still win.


def _load_dotenv(env_path: Path) -> int:
    """Load KEY=VALUE pairs from env_path into os.environ.

    Returns the number of variables loaded. Existing environment variables
    are NOT overwritten, matching python-dotenv default behavior. Failures
    to read the file are non-fatal (logged to stderr, execution continues).
    """
    if not env_path.exists():
        return 0

    loaded = 0
    try:
        with env_path.open("r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[len("export ") :].lstrip()
                if "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                if not key:
                    continue
                value = value.strip()
                # Strip matching surrounding quotes
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                # Respect pre-existing environment values (shell overrides win)
                if key not in os.environ:
                    os.environ[key] = value
                    loaded += 1
    except OSError as e:
        print(
            f"[prompt_executor] WARNING: failed to read {env_path}: {e}",
            file=sys.stderr,
        )
    return loaded


_DOTENV_LOADED_COUNT = _load_dotenv(PROJECT_ROOT / ".env")

# Runtime files — initialized per-instance by init_runtime_files()
# Each instance gets its own files keyed by target folder name.
PID_FILE: Path | None = None
LOG_FILE: Path | None = None
FAILURES_FILE: Path | None = None


def init_runtime_files(target_folder: Path) -> str:
    """
    Derive runtime file paths from target folder name for parallel execution.
    Returns the slug used for file naming.
    """
    global PID_FILE, LOG_FILE, FAILURES_FILE
    slug = target_folder.name  # e.g., "fire-and-forget", "blog-system"
    PID_FILE = SCRIPT_DIR / f".prompt_executor_{slug}.pid"
    LOG_FILE = SCRIPT_DIR / f".prompt_executor_{slug}.log"
    FAILURES_FILE = SCRIPT_DIR / f".prompt_executor_{slug}_failures.log"
    return slug


# ── Scheduler / Cron Paths ──────────────────────────────────────────────────
#
# The scheduler-daemon owns its own PID + log pair, keyed as "scheduler",
# so that `status` / `stop` can reason about it uniformly with per-folder
# daemons. The jobs file is a single JSON document shared by add / list /
# remove / scheduler-daemon (atomic read/modify/write via os.replace()).

JOBS_FILE = SCRIPT_DIR / ".prompt_executor_jobs.json"
SCHEDULER_SLUG = "scheduler"
SCHEDULER_PID_FILE = SCRIPT_DIR / f".prompt_executor_{SCHEDULER_SLUG}.pid"
SCHEDULER_LOG_FILE = SCRIPT_DIR / f".prompt_executor_{SCHEDULER_SLUG}.log"

# Scheduler wake-up cadence (seconds). The loop recomputes the next-due
# trigger on every tick; 30 s is more than enough granularity for cron's
# 1-minute resolution and for --in / --at schedules.
SCHEDULER_TICK_SECONDS = 30


# ── Execution Configuration ─────────────────────────────────────────────────

# Backend constants
BACKEND_CLAUDE = "claude"
BACKEND_OPENCODE = "opencode"

# CLI binary names
CLAUDE_BIN = "claude"
OPENCODE_BIN = "opencode"

# Anthropic model short names (route to Claude Code)
ANTHROPIC_MODELS = {"opus", "sonnet", "haiku"}

# Resolve short names to full model IDs.
#
# Opus and Sonnet default to their 1M-context variants. Prompt-executor prompts
# routinely ask Claude Code to read many large files across the repo, which
# fills the 200k context window and triggers Claude Code's
# "Autocompact is thrashing" failure. The [1m] variants give 5x more headroom
# and eliminate this failure mode for all realistic multi-file prompts.
# Explicit -200k short names are provided for users who want the smaller
# (cheaper) variant.
MODEL_ALIASES = {
    # Anthropic Claude models
    "opus": "claude-opus-4-7[1m]",
    "sonnet": "claude-sonnet-4-6[1m]",
    "haiku": "claude-haiku-4-5-20251001",
    "opus-200k": "claude-opus-4-7",
    "sonnet-200k": "claude-sonnet-4-6",
    # Z.AI GLM models (5-model family with zai/ namespace prefix)
    "glm-5.1": "zai/glm-5.1",
    "glm-5": "zai/glm-5",
    "glm-5-turbo": "zai/glm-5-turbo",
    "glm-4.7": "zai/glm-4.7",
    "glm-4.7-flash": "zai/glm-4.7-flash",
    "flash": "zai/glm-4.7-flash",  # Convenience alias for glm-4.7-flash
    "glm": "zai/glm-5.1",  # Default alias for glm
}

EFFORT = "high"  # low | medium | high | max
WAIT_MINUTES = 5  # rest between prompts
TIMEOUT_SECONDS = 3600  # 60 minutes per prompt execution
MAX_RETRIES = 3  # retries per prompt before skipping
RETRY_WAIT_MINUTES = 10  # base wait between retries (doubles each retry)
MAX_CRASHES = 5  # auto-restart limit before giving up
ALLOWED_TOOLS = "Read,Write,Edit,Bash,Glob,Grep,Agent,Skill,ToolSearch"

MCP_ERROR_PATTERNS = [
    r"MCP server '([^']+)' failed",
    r"mcp.*timeout",
    r"mcp.*authentication",
    r"mcp.*unreachable",
]

SKILL_ERROR_PATTERNS = [
    r"Skill '([^']+)' not found",
    r"skill validation failed",
    r"skill permission denied",
]

# ── Unrecoverable error patterns ────────────────────────────────────────────
#
# Substrings that — when seen in the combined stdout+stderr of a failed run —
# mean the prompt cannot succeed by retrying. execute_prompt returns
# RESULT_SKIP on a hit and the retry loop breaks out immediately instead of
# burning the full retry budget (which for large values like --max-retries 30
# can waste multiple hours per stuck prompt).
#
# Keep this list explicit and narrow. Over-matching would silently skip real
# transient failures; under-matching is safe (falls back to normal retries).
UNRECOVERABLE_ERROR_PATTERNS = (
    # Claude Code context window thrashing. Deterministic on multi-file
    # prompts that exceed the 200k window. Defaulting opus/sonnet to the 1M
    # variants fixes the common case; this is the safety net for the rest.
    "Autocompact is thrashing",
    # Safety net for stale OpenCode invocations that slipped through the
    # alias-resolution fix. Should not occur in practice but prevents
    # regression if MODEL_ALIASES drifts.
    "ProviderModelNotFoundError",
)

# ── Reference / non-executable prompt file detection ────────────────────────
#
# Some .md files in a prompt folder are human-readable overviews, READMEs, or
# tables of contents pointing at the *actual* actionable prompts in the same
# folder. Feeding them to an LLM produces conversational text output and zero
# tool calls, which the file-change gate then (correctly) rejects — and the
# daemon burns its entire retry budget re-running a file that can never pass.
#
# Filenames matching any of these case-insensitive substrings are auto-skipped
# at collection time. The `_done` suffix is stripped before matching so that
# already-processed-but-renamed files are still caught if they reappear.
#
# This is a convention-based filter. If a user genuinely wants to execute a
# file with one of these names, rename it.
REFERENCE_FILENAME_SUBSTRINGS = (
    "overview",
    "readme",
    "table-of-contents",
    "toc",
    "index-of-prompts",
    "architecture",
    "reference",
    "dependency-graph",
)

# Content-level markers that flag a prompt file as a reference / architecture
# document. If a run produces no filesystem changes AND the prompt file
# content matches one of these markers, we treat the run as SUCCESS instead
# of burning the retry budget on a file that was never meant to make edits.
REFERENCE_CONTENT_MARKERS = (
    "architecture overview",
    "architecture summary",
    "architecture reference",
    "architecture document",
    "# architecture",
    "## architecture",
    "table of contents",
    "## overview",
    "# overview",
    "reference document",
    "read-only reference",
    "dependency graph",
)

# Validation / verification prompts that MUST execute (they report PASS/FAIL)
# but whose output is expected to be text-only. They legitimately produce zero
# filesystem changes on a successful run, so the post-run "no file changes"
# gate must not retry them forever. These substrings are matched against the
# filename stem (case-insensitive); they are NOT used at collection time.
VALIDATION_FILENAME_SUBSTRINGS = (
    "validate",
    "validation",
    "verify",
    "verification",
    "check-",
    "-check",
    "sanity",
    "audit",
)

# NOTE: validator detection is intentionally filename-only. Content markers
# (e.g. "pass/fail", "verdict:") are too broad and leak into implementation
# prompts that mention those terms in prose. Validators must be named
# ``*-validate-*`` / ``*-verify-*`` / ``*-audit-*`` for this gate to trip.

# Conversational LLM replies that mean "I need more instructions" — these
# never become real file changes, so retrying is waste. Matched against the
# last ~2000 chars of stdout, case-insensitively. When a no-change run's
# output matches any of these, we short-circuit the retry budget by
# returning RESULT_SKIP instead of RESULT_ERROR.
CONVERSATIONAL_NO_OP_MARKERS = (
    "what would you like me to do",
    "which direction should i take",
    "which prompt would you like me to",
    "what's the task",
    "what's the goal",
    "what would you like me to implement",
    "would you like me to start",
    "let me know what you'd like",
    "what would you like me to work on",
    "which prompt(s) would you like me to",
    "which prompt(s) should i start",
)


def _no_change_ok_kind(prompt_file: Path) -> str | None:
    """
    If this prompt is one where "exit 0 with no filesystem changes" is a
    legitimate success state, return the kind ("reference" or "validation").
    Otherwise return None.

    - Reference files: architecture overviews, READMEs, TOCs. These are also
      skipped entirely at collection time via ``is_reference_file`` — this
      helper exists as a safety net for content-based detection.
    - Validation files: ``*-validate-*`` / ``*-verify-*`` prompts that run
      checks and emit PASS/FAIL reports without editing anything.
    """
    name = prompt_file.name.lower()
    stem = name[:-3] if name.endswith(".md") else name
    if stem.endswith("_done"):
        stem = stem[: -len("_done")]

    if any(s in stem for s in REFERENCE_FILENAME_SUBSTRINGS):
        return "reference"
    if any(s in stem for s in VALIDATION_FILENAME_SUBSTRINGS):
        return "validation"

    try:
        head = prompt_file.read_text(errors="ignore")[:4000].lower()
    except OSError:
        return None
    if any(m in head for m in REFERENCE_CONTENT_MARKERS):
        return "reference"
    return None


def _is_reference_prompt(prompt_file: Path) -> bool:
    """Back-compat wrapper: true if reference or validation prompt."""
    return _no_change_ok_kind(prompt_file) is not None


def detect_backend(model: str) -> str:
    """
    Determine which CLI backend to use based on the model name.
    - Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code
    - Z.AI GLM models (glm-*, zai/*) → OpenCode
    - Provider-prefixed models (*/*) → OpenCode
    - Everything else defaults to OpenCode
    """
    model_lower = model.lower()

    # Resolve alias first to check what it maps to
    resolved = MODEL_ALIASES.get(model_lower)

    # Check for Anthropic models first (these always use Claude Code backend)
    if model_lower in ANTHROPIC_MODELS or model_lower.startswith("claude"):
        return BACKEND_CLAUDE

    # If the alias resolves to a claude-* model, route to Claude backend
    if resolved and resolved.startswith("claude"):
        return BACKEND_CLAUDE

    # Check for Z.AI GLM models (glm-* prefix or zai/* namespace prefix)
    if model_lower.startswith("glm-") or model_lower.startswith("zai/"):
        return BACKEND_OPENCODE

    # Provider-prefixed models (e.g., "openai/gpt-4", "anthropic/claude-3") → OpenCode
    if "/" in model_lower:
        return BACKEND_OPENCODE

    # Default: OpenCode backend for unknown models
    return BACKEND_OPENCODE


def _validate_env_vars(backend: str) -> list[str]:
    """
    Return a list of missing required env vars for the given backend.
    Does NOT raise — caller decides what to do with the result.
    """
    missing = []
    if backend == BACKEND_OPENCODE:
        if not os.environ.get("ZAI_API_KEY"):
            missing.append("ZAI_API_KEY")
    elif backend == BACKEND_CLAUDE:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            missing.append("ANTHROPIC_API_KEY")
    return missing


_env_warned: set[str] = set()


def _check_env_and_warn(backend: str, model: str) -> None:
    """
    Log a warning if env vars are missing. Does not raise.

    The Claude Code CLI has its own subscription auth (stored in
    ``~/.claude`` by ``claude login``) and does NOT require
    ``ANTHROPIC_API_KEY`` in the caller environment. Warning about it on
    every prompt produces dozens of false-positives per daemon lifetime.
    Downgrade to INFO and emit once per run.
    """
    missing = _validate_env_vars(backend)
    if not missing:
        return
    resolved = MODEL_ALIASES.get(model.lower(), model)

    if backend == BACKEND_CLAUDE and missing == ["ANTHROPIC_API_KEY"]:
        if "claude_anthropic_key" in _env_warned:
            return
        _env_warned.add("claude_anthropic_key")
        log(
            f"  INFO: ANTHROPIC_API_KEY not set; relying on 'claude' CLI "
            f"subscription auth for '{resolved}'."
        )
        return

    log(f"  WARNING: Missing env vars for model '{resolved}': {', '.join(missing)}")
    log(f"           Set them in your shell or .env before running.")


def _find_opencode_config(start_dir: Path) -> Path | None:
    """
    Walk upward from start_dir looking for .opencode/opencode.jsonc or
    .opencode/opencode.json. Returns the path to the config file, or None.
    """
    current = start_dir.resolve()
    while True:
        for name in ("opencode.jsonc", "opencode.json"):
            candidate = current / ".opencode" / name
            if candidate.exists():
                return candidate
        if current.parent == current:
            return None
        current = current.parent


def _ensure_opencode_config(working_dir: Path) -> None:
    """Log a warning if no .opencode/opencode.jsonc is discoverable."""
    config = _find_opencode_config(working_dir)
    if config is None:
        log(f"  WARNING: No .opencode/opencode.jsonc found under {working_dir}")
        log(f"           MCP servers and custom skills will NOT be loaded.")
    else:
        log(f"  Using OpenCode config: {config}")


def _classify_stderr(stderr: str) -> str | None:
    """
    Scan stderr for known MCP or skill error patterns.
    Returns a one-line classification label, or None if no pattern matches.
    """
    import re

    for pat in MCP_ERROR_PATTERNS:
        if re.search(pat, stderr, re.IGNORECASE):
            return "MCP_ERROR"
    for pat in SKILL_ERROR_PATTERNS:
        if re.search(pat, stderr, re.IGNORECASE):
            return "SKILL_ERROR"
    return None


# ── Result codes ────────────────────────────────────────────────────────────

RESULT_SUCCESS = "success"  # completed, returncode 0
RESULT_TIMEOUT = "timeout"  # subprocess timed out → retryable
RESULT_ERROR = "error"  # non-zero exit code → retryable
RESULT_FATAL = "fatal"  # unrecoverable (claude missing, file unreadable)
RESULT_SKIP = "skip"  # prompt-specific unrecoverable → skip, daemon continues

RETRYABLE = {RESULT_TIMEOUT, RESULT_ERROR}

# ── Logging (fsync on every write — nothing is ever lost) ───────────────────


LOG_ROTATE_BYTES = 10 * 1024 * 1024  # 10 MiB


def _maybe_rotate_log() -> None:
    """Rotate LOG_FILE once it crosses LOG_ROTATE_BYTES. Best-effort."""
    try:
        if LOG_FILE.exists() and LOG_FILE.stat().st_size >= LOG_ROTATE_BYTES:
            rotated = LOG_FILE.with_suffix(LOG_FILE.suffix + ".1")
            try:
                if rotated.exists():
                    rotated.unlink()
            except OSError:
                pass
            LOG_FILE.rename(rotated)
    except OSError:
        pass


def log(msg: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"
    try:
        _maybe_rotate_log()
        with open(LOG_FILE, "a") as f:
            f.write(line)
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        pass  # If we can't log, don't crash the process


def log_failure(prompt_path: str, attempts: int, last_error: str) -> None:
    """Append to the dedicated failures log."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(FAILURES_FILE, "a") as f:
            f.write(f"[{timestamp}] SKIPPED: {prompt_path}\n")
            f.write(f"  Attempts: {attempts}\n")
            f.write(f"  Last error: {last_error}\n\n")
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        log(f"  WARNING: Could not write to failures log: {FAILURES_FILE}")


# ── Crash handlers (never die silently) ─────────────────────────────────────


def install_crash_handlers() -> None:
    """Install global exception hook and atexit handler."""

    def crash_handler(exc_type, exc_value, exc_tb):
        tb_str = "".join(tb_module.format_exception(exc_type, exc_value, exc_tb))
        log(f"UNHANDLED EXCEPTION:\n{tb_str}")

    sys.excepthook = crash_handler

    def on_exit():
        log("Process exiting.")

    atexit.register(on_exit)


# ── PID management ──────────────────────────────────────────────────────────


def read_pid() -> int | None:
    try:
        pid = int(PID_FILE.read_text().strip())
        os.kill(pid, 0)
        return pid
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        return None


def write_pid(pid: int) -> None:
    PID_FILE.write_text(str(pid))


def remove_pid() -> None:
    try:
        PID_FILE.unlink()
    except FileNotFoundError:
        pass


def _read_pid_from_file(pid_file: Path) -> int | None:
    """Read PID from an arbitrary PID file (not the global). Used for multi-instance ops."""
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 0)
        return pid
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        return None


def clean_stale_pid() -> None:
    """If PID file exists but process is dead, clean it up."""
    if not PID_FILE.exists():
        return
    pid = read_pid()
    if pid is None:
        log("Cleaned stale PID file from previous crash.")
        remove_pid()


def find_matching_executor_pids(target_folder: Path) -> list[int]:
    """Scan the process table for running prompt_executor processes on this folder.

    Catches three cases the PID file does not:
    - Foreground `run` invocations (never write a PID file).
    - Daemons whose PID file was deleted out of band.
    - Pre-fix daemons spawned by an older copy of this script.

    Source of truth is /proc/<pid>/cmdline (NUL-separated argv) rather than
    `ps -eo args`, because embedded shells (e.g. Claude Code, some IDEs) invoke
    scripts via `bash -c "<entire script body>"` — the parent bash's cmdline
    contains the script text verbatim, causing grep-style matches to false-
    positive whenever the script text mentions "prompt_executor.py" as a
    literal string.

    A match requires:
      1. The executable (argv[0] basename) to look like a python interpreter.
      2. Some argv element to end with "prompt_executor.py".
      3. Some argv element contains the slug as an **exact path segment**
         (split on "/"), not as a substring. This prevents false positives
         when the slug is a short common word — e.g. slug ``ai`` used to
         match ``--retry-wait`` because the byte substring ``ai`` lives
         inside ``wait``. Requiring a path-segment match means only argv
         like ``prompts/ai`` or ``/home/.../prompts/ai`` is flagged.
      4. The PID is not this process's own PID.

    Returns [] on any /proc access failure — non-fatal, detection degrades
    gracefully to the PID-file check.
    """
    slug = target_folder.name
    if not slug:
        return []

    proc_root = Path("/proc")
    if not proc_root.is_dir():
        return []

    self_pid = os.getpid()
    matches: list[int] = []

    try:
        pid_dirs = [p for p in proc_root.iterdir() if p.name.isdigit()]
    except OSError:
        return []

    for pid_dir in pid_dirs:
        try:
            pid = int(pid_dir.name)
        except ValueError:  # pragma: no cover
            continue
        if pid == self_pid:
            continue
        cmdline_file = pid_dir / "cmdline"
        try:
            raw = cmdline_file.read_bytes()
        except (FileNotFoundError, PermissionError, ProcessLookupError, OSError):
            continue
        if not raw:
            continue
        argv = [a for a in raw.split(b"\x00") if a]
        if not argv:
            continue

        # 1. Executable must be a python interpreter. We check argv[0] basename.
        exe_name = argv[0].rsplit(b"/", 1)[-1].lower()
        if not exe_name.startswith(b"python"):
            continue

        # 2. Some argv element ends with prompt_executor.py
        if not any(arg.endswith(b"prompt_executor.py") for arg in argv[1:]):
            continue

        # 3. Some argv element contains the slug as an exact path segment.
        #    Splitting on "/" and doing equality match avoids byte-substring
        #    false positives (e.g. slug "ai" matching "--retry-wait").
        slug_bytes = slug.encode("utf-8")
        matched_slug = False
        for arg in argv[1:]:
            if slug_bytes in arg.split(b"/"):
                matched_slug = True
                break
        if not matched_slug:
            continue

        matches.append(pid)

    return matches


def assert_no_duplicate_executor(target: Path) -> None:
    """Refuse to start a new executor when another is already targeting this folder.

    The existing PID-file check only catches daemons started via `cmd_start`.
    This adds a second layer that scans the process table and catches foreground
    `run` processes and orphaned daemons too. Exits with a helpful error
    instead of silently racing on the same log file.
    """
    rogue_pids = find_matching_executor_pids(target)
    if not rogue_pids:
        return
    slug = target.name
    pid_list = ", ".join(str(p) for p in rogue_pids)
    print(
        f"ERROR: Another prompt_executor is already running for [{slug}] "
        f"(PID(s) {pid_list}).",
        file=sys.stderr,
    )
    print(
        "Stop it first with: "
        f"python3 prompt-executor/prompt_executor.py stop {target.relative_to(PROJECT_ROOT) if target.is_absolute() else target}",
        file=sys.stderr,
    )
    print(
        f"Or force-kill any stragglers: kill {pid_list}",
        file=sys.stderr,
    )
    sys.exit(1)


# ── Sleep with heartbeat ───────────────────────────────────────────────────


def safe_sleep(minutes: int, label: str = "next prompt") -> None:
    """Sleep in small chunks with heartbeat logging so we know the process is alive."""
    total_seconds = minutes * 60
    if total_seconds <= 0:
        return
    elapsed = 0
    HEARTBEAT_INTERVAL = 120  # log every 2 minutes
    log(f"  Sleeping {minutes}m before {label}...")
    while elapsed < total_seconds:
        chunk = min(HEARTBEAT_INTERVAL, total_seconds - elapsed)
        time.sleep(chunk)
        elapsed += chunk
        remaining_min = (total_seconds - elapsed) // 60
        if remaining_min > 0:
            log(f"  ... heartbeat ({remaining_min}m remaining)")


# ── Folder/path resolution ──────────────────────────────────────────────────


def resolve_target_folder(folder_arg: str) -> Path:
    """Resolve the target folder relative to PROJECT_ROOT or as absolute path."""
    candidate = Path(folder_arg)
    if candidate.is_absolute():
        target = candidate
    else:
        target = (PROJECT_ROOT / candidate).resolve()

    if not target.exists():
        print(f"Error: folder does not exist: {target}")
        sys.exit(1)
    if not target.is_dir():
        print(f"Error: not a directory: {target}")
        sys.exit(1)

    return target


# ── Prompt discovery (recursive, sorted, skip _done) ───────────────────────


def is_done(name: str) -> bool:
    """Check if a file stem or folder name is marked as done."""
    return name.endswith("_done")


def is_reference_file(file_path: Path) -> bool:
    """Return True if this .md file is a non-executable reference/overview doc.

    Matches against REFERENCE_FILENAME_SUBSTRINGS (case-insensitive). Strips a
    trailing `_done` suffix before matching so files that were previously
    processed and renamed are still recognized on re-scans. The directory name
    is NOT considered — we only match the file stem, so a prompt inside a
    folder named `overview-refactor/` is still executable.
    """
    stem = file_path.stem.lower()
    if stem.endswith("_done"):
        stem = stem[: -len("_done")]
    return any(substr in stem for substr in REFERENCE_FILENAME_SUBSTRINGS)


def collect_pending_items(directory: Path) -> list[Path]:
    """
    Collect all pending .md files recursively, depth-first, sorted by name.

    At each directory level:
      - Entries sorted alphabetically (numeric prefix ensures correct order)
      - Hidden entries (starting with .) are skipped
      - Folders ending with _done are skipped
      - Files ending with _done.md are skipped
      - .md files are collected in order
      - Sub-directories are recursed into in order

    Returns a flat, ordered list of .md file paths to execute.
    """
    if not directory.exists() or not directory.is_dir():
        return []

    items: list[Path] = []

    for entry in sorted(directory.iterdir(), key=lambda e: e.name):
        # Skip hidden files/folders
        if entry.name.startswith("."):
            continue

        if entry.is_dir():
            # Skip completed folders
            if is_done(entry.name):
                continue
            # Recurse into pending sub-folders
            items.extend(collect_pending_items(entry))

        elif entry.is_file() and entry.suffix == ".md":
            # Skip completed files
            if is_done(entry.stem):
                continue
            # Skip reference / overview / README files — feeding them to the
            # LLM produces text-only output which the file-change gate then
            # rejects, wasting the entire retry budget on an unexecutable file.
            if is_reference_file(entry):
                log(
                    f"  SKIP: Reference file (overview/README, not executable): {entry.name}"
                )
                continue
            # Skip empty / whitespace-only prompt files — executing them would
            # either mark them as done without real work (old bug) or produce
            # confusing LLM responses. Log a warning and leave them on disk.
            try:
                if not entry.read_text(encoding="utf-8").strip():
                    log(f"  SKIP: Empty prompt file (not marked done): {entry.name}")
                    continue
            except (OSError, UnicodeDecodeError) as e:
                log(f"  WARNING: Could not read {entry.name}: {e}")
                continue
            items.append(entry)

    return items


def get_pending_files_in_dir(directory: Path) -> list[Path]:
    """Return pending .md files in a single directory (non-recursive)."""
    if not directory.exists():
        return []
    return sorted(
        f
        for f in directory.iterdir()
        if f.is_file() and f.suffix == ".md" and not is_done(f.stem)
    )


def has_done_files_in_dir(directory: Path) -> bool:
    """True if the directory contains at least one _done.md file."""
    return any(
        f.is_file() and f.suffix == ".md" and is_done(f.stem)
        for f in directory.iterdir()
    )


def is_dir_fully_complete(directory: Path) -> bool:
    """
    True when a directory has no pending work:
    - No pending .md files
    - No pending sub-directories (all sub-dirs are _done or empty)
    """
    for entry in directory.iterdir():
        if entry.name.startswith("."):
            continue
        if entry.is_dir() and not is_done(entry.name):
            return False
        if entry.is_file() and entry.suffix == ".md" and not is_done(entry.stem):
            return False
    return True


# ── Rename helpers ──────────────────────────────────────────────────────────


def mark_file_done(filepath: Path) -> Path:
    """Rename file.md -> file_done.md."""
    new_path = filepath.parent / (filepath.stem + "_done" + filepath.suffix)
    filepath.rename(new_path)
    log(f"  Renamed: {filepath.name} -> {new_path.name}")
    return new_path


def try_mark_ancestors_done(filepath: Path, target_root: Path) -> None:
    """
    After completing a file, walk up to check if parent folders
    are now fully complete. Mark them _done bottom-up, stopping
    at (but not including) the target_root.
    """
    current = filepath.parent

    while current != target_root and current != target_root.parent:
        if is_dir_fully_complete(current) and has_done_files_in_dir(current):
            new_path = current.parent / (current.name + "_done")
            try:
                current.rename(new_path)
                log(f"  Folder complete: {current.name} -> {new_path.name}")
            except OSError as e:
                log(f"  WARNING: Could not rename folder {current.name}: {e}")
                break
            current = new_path.parent  # Move up
        else:
            break  # Not complete yet, stop


# ── Git-based change detection ────────────────────────────────────────────

PromptResult = namedtuple(
    "PromptResult", ["result_code", "err_msg", "stdout", "files_changed"]
)


def snapshot_git_state(cwd: Path) -> set[str] | None:
    """
    Snapshot the current git state as a set of changed/untracked file paths.

    Returns None if git is not available (non-fatal — snapshots disabled).
    Runs three git commands and merges their output into a single set.
    """
    try:
        all_lines: set[str] = set()
        for cmd in [
            ["git", "diff", "--name-only"],
            ["git", "diff", "--cached", "--name-only"],
            ["git", "ls-files", "--others", "--exclude-standard"],
        ]:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(cwd),
                timeout=30,
            )
            if result.returncode != 0:
                return None
            for line in (result.stdout or "").strip().splitlines():
                if line:
                    all_lines.add(line)
        return all_lines
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None


def detect_git_changes(before: set[str] | None, after: set[str] | None) -> bool:
    """
    Return True if git state changed between snapshots.

    Treats None snapshots as 'unknown' — only returns False (no changes)
    when both snapshots are non-None and identical.
    """
    if before is None or after is None:
        return True
    return before != after


# ── Prompt execution ───────────────────────────────────────────────────────


def _build_claude_cmd(model: str) -> list[str]:
    """Build Claude Code CLI command.

    Uses `--permission-mode bypassPermissions` so Claude can actually use
    Edit/Write/Bash tools in non-interactive `-p` mode. Without it, Claude
    may silently produce text-only output because there is no UI to
    approve tool calls, which then trips the "no filesystem changes"
    retry loop in execute_prompt().
    """
    resolved = MODEL_ALIASES.get(model.lower(), model)
    return [
        CLAUDE_BIN,
        "-p",
        "--model",
        resolved,
        "--effort",
        EFFORT,
        "--permission-mode",
        "bypassPermissions",
        "--allowedTools",
        ALLOWED_TOOLS,
        "--output-format",
        "text",
    ]


def _build_opencode_cmd(
    model: str,
    prompt_content: str | None = None,
    prompt_file_path: Path | None = None,
    agent: str | None = None,
    continue_session: bool = False,
    skip_permissions: bool = True,
) -> tuple[list[str], str | None]:
    """
    Build OpenCode CLI command.

    Returns (cmd, stdin_input). For prompts <=32KB the content is passed as a
    positional argument and stdin_input is None. For prompts >32KB (or when
    prompt_file_path is provided), the prompt is piped via stdin and
    stdin_input holds the content — OpenCode reads stdin when not attached to
    a TTY (run.ts line 350).

    Valid flags verified against opencode/packages/opencode/src/cli/cmd/run.ts:
      --model provider/model   (required for explicit routing)
      --format default|json    (default is "default", kept for explicitness)
      --agent <name>           (primary agent from .opencode/agent/*.md)
      --continue | -c          (resume last session)
      --file <path>            (attach file, repeatable)
      --dangerously-skip-permissions (auto-approve tool calls)

    Args:
        model: Short alias (e.g. "glm-5.1") or fully qualified ID
            (e.g. "zai/glm-5.1"). Resolved via MODEL_ALIASES.
        prompt_content: Prompt text (used when prompt_file_path is None and
            prompt is small enough for a positional arg or stdin piping).
        prompt_file_path: Path to a prompt file to attach via --file.
        agent: Optional agent name from .opencode/agent/*.md.
        continue_session: Pass --continue to resume a prior session.
        skip_permissions: Pass --dangerously-skip-permissions for non-interactive
            execution (default True since prompt_executor has no TTY).
    """
    resolved = MODEL_ALIASES.get(model.lower(), model)
    cmd = [
        OPENCODE_BIN,
        "run",
        "--model",
        resolved,
    ]

    if agent:
        cmd.extend(["--agent", agent])

    if continue_session:
        cmd.append("--continue")

    if skip_permissions:
        cmd.append("--dangerously-skip-permissions")

    if prompt_file_path:
        cmd.extend(["--file", str(prompt_file_path)])
        return cmd, None

    if prompt_content is None:
        raise ValueError("Either prompt_content or prompt_file_path must be provided")

    if len(prompt_content) > 32768:
        return cmd, prompt_content

    cmd.append(prompt_content)
    return cmd, None


def execute_prompt(
    prompt_file: Path,
    model: str,
    backend: str,
    snapshot_before: set[str] | None = None,
    agent: str | None = None,
    working_dir: Path | None = None,
) -> PromptResult:
    """
    Execute a single prompt via Claude Code CLI or OpenCode CLI.
    Returns a PromptResult(result_code, err_msg, stdout, files_changed).

    When snapshot_before is provided, takes a git snapshot after execution
    and compares to detect whether the LLM actually modified files.
    A prompt that exits 0 but produces no file changes is treated as a failure
    (RESULT_ERROR with files_changed=False) so the retry loop will re-attempt it.

    For OpenCode backend:
    - Prompts <= 32KB are passed as positional arguments
    - Prompts > 32KB are piped via stdin (OpenCode reads stdin when not a TTY)

    Args:
        prompt_file: Path to the .md prompt to execute.
        model: Short model alias or fully qualified model ID.
        backend: BACKEND_CLAUDE or BACKEND_OPENCODE.
        snapshot_before: Git state snapshot for change detection.
        agent: Optional agent name for OpenCode backend.
        working_dir: Directory to run the subprocess from. Defaults to PROJECT_ROOT.
    """
    effective_cwd = working_dir or PROJECT_ROOT

    try:
        rel = prompt_file.relative_to(PROJECT_ROOT)
    except ValueError:
        rel = prompt_file

    log(f"  Executing: {rel}")

    _check_env_and_warn(backend, model)

    if backend == BACKEND_OPENCODE:
        _ensure_opencode_config(effective_cwd)

    try:
        prompt_content = prompt_file.read_text(encoding="utf-8")
    except PermissionError as e:
        log(f"  FATAL: Permission denied reading file: {e}")
        return PromptResult(RESULT_FATAL, str(e), "", True)
    except OSError as e:
        log(f"  FATAL: OS error reading file: {e}")
        return PromptResult(RESULT_FATAL, str(e), "", True)

    if not prompt_content.strip():
        log(f"  SKIP: Empty prompt file")
        return PromptResult(RESULT_SUCCESS, "", "", True)

    if backend == BACKEND_CLAUDE:
        cmd = _build_claude_cmd(model)
        stdin_input = prompt_content
        resolved_model = MODEL_ALIASES.get(model.lower(), model)
        log(
            f"  CMD: [claude] claude -p --model {resolved_model} --effort {EFFORT} --permission-mode bypassPermissions (stdin: {len(prompt_content)} chars)"
        )
    else:
        resolved_model = MODEL_ALIASES.get(model.lower(), model)
        prompt_size = len(prompt_content)
        cmd, stdin_input = _build_opencode_cmd(
            model, prompt_content=prompt_content, agent=agent
        )
        if stdin_input is not None:
            log(
                f"  CMD: [opencode] opencode run --model {resolved_model} --dangerously-skip-permissions (stdin: {prompt_size} chars, >32KB)"
            )
        else:
            log(
                f"  CMD: [opencode] opencode run --model {resolved_model} --dangerously-skip-permissions (arg: {prompt_size} chars)"
            )

    bin_name = CLAUDE_BIN if backend == BACKEND_CLAUDE else OPENCODE_BIN

    child_env = os.environ.copy()

    # Claude CLI uses OAuth/subscription auth by default. A leftover
    # ANTHROPIC_API_KEY (often a placeholder from the project .env) overrides
    # OAuth and makes the CLI reject every call with "Invalid API key".
    if backend == BACKEND_CLAUDE:
        for key in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"):
            child_env.pop(key, None)

    if backend == BACKEND_OPENCODE and os.environ.get("ZAI_API_KEY"):
        child_env["ZAI_API_KEY"] = os.environ["ZAI_API_KEY"]

    if os.environ.get("OPENCODE_CONFIG"):
        child_env["OPENCODE_CONFIG"] = os.environ["OPENCODE_CONFIG"]

    try:
        result = subprocess.run(
            cmd,
            input=stdin_input,
            cwd=str(effective_cwd),
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            env=child_env,
        )

        stdout_text = result.stdout or ""
        if stdout_text:
            tail = stdout_text[-3000:]
            log(f"  STDOUT (last 3000 chars):\n{tail}")
        if result.stderr:
            tail = result.stderr[-1000:]
            log(f"  STDERR:\n{tail}")

        combined_output = stdout_text + (result.stderr or "")
        for pattern in UNRECOVERABLE_ERROR_PATTERNS:
            if pattern in combined_output:
                err_msg = f"Unrecoverable: {pattern}"
                log(f"  SKIP: {err_msg} — skipping prompt without retrying.")
                log_failure(str(rel), 1, err_msg)
                return PromptResult(RESULT_SKIP, err_msg, stdout_text, True)

        if result.returncode != 0:
            stderr_text = result.stderr or ""
            classification = _classify_stderr(stderr_text)
            if classification:
                log(f"  CLASSIFIED: {classification}")
            err_msg = f"{bin_name} exited with code {result.returncode}"
            log(f"  ERROR: {err_msg}")
            return PromptResult(RESULT_ERROR, err_msg, stdout_text, True)

        if snapshot_before is not None:
            snapshot_after = snapshot_git_state(PROJECT_ROOT)
            files_changed = detect_git_changes(snapshot_before, snapshot_after)
            if not files_changed:
                kind = _no_change_ok_kind(prompt_file)
                if kind == "validation":
                    log(
                        f"  INFO: No filesystem changes, but '{prompt_file.name}' "
                        f"is a validation/verify prompt. Text-only PASS report is "
                        f"the expected outcome — treating as success."
                    )
                    return PromptResult(RESULT_SUCCESS, "", stdout_text, False)
                if kind == "reference":
                    log(
                        f"  INFO: No filesystem changes, but '{prompt_file.name}' "
                        f"is a reference/architecture document. Treating as success."
                    )
                    return PromptResult(RESULT_SUCCESS, "", stdout_text, False)
                log(f"  WARNING: Exit code 0 but NO filesystem changes detected.")
                log(f"  WARNING: LLM likely produced text output without using tools.")
                err_msg = (
                    "No filesystem changes detected (text-only output, no tool use)"
                )
                tail = (stdout_text or "").lower()[-2000:]
                if any(m in tail for m in CONVERSATIONAL_NO_OP_MARKERS):
                    log(
                        f"  SKIP: LLM replied conversationally "
                        f"('what should I do?'-style). Retrying will not help — "
                        f"marking prompt as unrecoverable."
                    )
                    log_failure(str(rel), 1, err_msg + " [conversational reply]")
                    return PromptResult(RESULT_SKIP, err_msg, stdout_text, False)
                log_failure(str(rel), 1, err_msg)
                return PromptResult(RESULT_ERROR, err_msg, stdout_text, False)

        log(f"  Completed successfully.")
        return PromptResult(RESULT_SUCCESS, "", stdout_text, True)

    except subprocess.TimeoutExpired:
        err_msg = f"Timed out after {TIMEOUT_SECONDS}s"
        log(f"  TIMEOUT: {err_msg}")
        return PromptResult(RESULT_TIMEOUT, err_msg, "", True)

    except FileNotFoundError:
        err_msg = f"'{bin_name}' not found in PATH. Is {backend.title()} installed?"
        log(f"  FATAL: {err_msg}")
        return PromptResult(RESULT_FATAL, err_msg, "", True)

    except MemoryError as e:
        err_msg = f"MemoryError: {e}"
        log(f"  FATAL: {err_msg}")
        return PromptResult(RESULT_FATAL, err_msg, "", True)

    except KeyboardInterrupt:
        raise

    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}"
        log(f"  ERROR: {err_msg}")
        return PromptResult(RESULT_ERROR, err_msg, "", True)


def execute_prompt_with_retry(
    prompt_file: Path,
    max_retries: int,
    retry_wait_min: int,
    model: str,
    backend: str,
    agent: str | None = None,
    working_dir: Path | None = None,
) -> tuple[bool, bool]:
    """
    Execute a prompt with retry logic and a fixed inter-attempt wait.

    Takes a git snapshot before each attempt and verifies file changes
    after each successful execution. If the LLM exits 0 but did not
    modify any files (text-only output), the attempt is treated as a
    retryable failure.

    The wait between attempts is exactly ``retry_wait_min`` minutes every
    time — no exponential backoff, no doubling. ``--retry-wait 1`` means
    one minute between every retry, regardless of attempt number.

    Returns (succeeded: bool, fatal: bool).
    - (True, False)  → prompt completed with real file changes, mark as done
    - (False, False) → all retries exhausted, skip and continue
    - (False, True)  → fatal error, stop everything
    """
    try:
        rel = str(prompt_file.relative_to(PROJECT_ROOT))
    except ValueError:
        rel = str(prompt_file)

    last_error = ""

    for attempt in range(1, max_retries + 1):
        log(f"  Attempt {attempt}/{max_retries}")

        snapshot_before = snapshot_git_state(PROJECT_ROOT)

        pr = execute_prompt(
            prompt_file,
            model,
            backend,
            snapshot_before,
            agent=agent,
            working_dir=working_dir,
        )

        if pr.result_code == RESULT_SUCCESS:
            return True, False

        if pr.result_code == RESULT_FATAL:
            log(f"  FATAL error on attempt {attempt} — stopping execution.")
            log_failure(rel, attempt, pr.err_msg)
            return False, True

        if pr.result_code == RESULT_SKIP:
            # Already logged to failures file by execute_prompt. Skip retries
            # entirely and let the main loop continue to the next prompt.
            log(f"  SKIPPED (unrecoverable): {prompt_file.name}")
            return False, False

        last_error = pr.err_msg

        if attempt < max_retries:
            safe_sleep(retry_wait_min, label=f"retry {attempt + 1}")
        else:
            log(f"  All {max_retries} attempts exhausted for: {prompt_file.name}")

    log_failure(rel, max_retries, last_error)
    return False, False


# ── Main orchestrator ──────────────────────────────────────────────────────


def run_all_prompts(
    target_folder: Path,
    wait_minutes: int,
    max_retries: int,
    retry_wait_min: int,
    model: str,
    backend: str,
    agent: str | None = None,
    working_dir: Path | None = None,
) -> None:
    """Execute all pending prompts in target_folder recursively."""
    pending = collect_pending_items(target_folder)

    if not pending:
        log(f"No pending prompts found in: {target_folder}")
        log("All done!")
        return

    total = len(pending)
    log(f"Found {total} pending prompt(s) in: {target_folder}")
    log(
        f"Config: backend={backend}, model={model}, wait={wait_minutes}m, retries={max_retries}, retry_wait={retry_wait_min}m, timeout={TIMEOUT_SECONDS}s"
    )
    log(f"Change detection: git-based (files_changed gate enabled)")

    log(f"\nExecution order:")
    for i, p in enumerate(pending, 1):
        try:
            rel = p.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = p
        log(f"  {i:3d}. {rel}")
    log("")

    first_prompt = True
    skipped: list[str] = []

    for idx, prompt_file in enumerate(pending, 1):
        if not first_prompt:
            safe_sleep(wait_minutes, label=f"prompt {idx}/{total}")
        first_prompt = False

        try:
            rel = prompt_file.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = prompt_file

        log(f"\n{'=' * 60}")
        log(f"PROMPT [{idx}/{total}]: {rel}")
        log(f"{'=' * 60}")

        succeeded, fatal = execute_prompt_with_retry(
            prompt_file,
            max_retries,
            retry_wait_min,
            model,
            backend,
            agent=agent,
            working_dir=working_dir,
        )

        if succeeded:
            mark_file_done(prompt_file)
            try_mark_ancestors_done(prompt_file, target_folder)
        elif fatal:
            log(f"  FATAL failure — stopping all execution.")
            if skipped:
                log(f"\n  Previously skipped prompts ({len(skipped)}):")
                for s in skipped:
                    log(f"    - {s}")
            return
        else:
            skipped.append(str(rel))
            log(f"  SKIPPED (retries exhausted): {prompt_file.name}")
            log(f"  Continuing to next prompt...")

    if is_dir_fully_complete(target_folder) and has_done_files_in_dir(target_folder):
        new_path = target_folder.parent / (target_folder.name + "_done")
        try:
            target_folder.rename(new_path)
            log(f"  Target folder complete: {target_folder.name} -> {new_path.name}")
        except OSError as e:
            log(f"  WARNING: Could not rename target folder: {e}")

    log(f"\n{'=' * 60}")
    if skipped:
        log(f"FINISHED with {len(skipped)} skipped prompt(s):")
        for s in skipped:
            log(f"  - {s}")
        log(f"Review: {FAILURES_FILE}")
    else:
        log("ALL PROMPTS EXECUTED SUCCESSFULLY!")
    log(f"{'=' * 60}")


# ── Resilient runner (auto-restart on crash) ───────────────────────────────


def resilient_run(
    target_folder: Path,
    wait_minutes: int,
    max_retries: int,
    retry_wait_min: int,
    model: str,
    backend: str,
    agent: str | None = None,
    working_dir: Path | None = None,
) -> None:
    """
    Wrap run_all_prompts in a crash-recovery loop.
    If the main loop crashes unexpectedly, wait 2 minutes and resume
    from where it left off (since _done tracking is durable).
    """
    crash_count = 0

    while crash_count < MAX_CRASHES:
        try:
            if not target_folder.exists():
                log(
                    f"Target folder no longer exists (possibly renamed to _done): {target_folder}"
                )
                return
            run_all_prompts(
                target_folder,
                wait_minutes,
                max_retries,
                retry_wait_min,
                model,
                backend,
                agent=agent,
                working_dir=working_dir,
            )
            return  # Normal completion
        except KeyboardInterrupt:
            log("Interrupted by user (KeyboardInterrupt).")
            return
        except SystemExit:
            raise  # Let SIGTERM handler work
        except Exception as e:
            crash_count += 1
            log(f"CRASH #{crash_count}/{MAX_CRASHES}: {type(e).__name__}: {e}")
            log(tb_module.format_exc())
            if crash_count < MAX_CRASHES:
                log(f"Auto-restarting in 2 minutes...")
                time.sleep(120)
                log(f"Resuming from where we left off (crash recovery)...")
            else:
                log(f"Too many crashes ({MAX_CRASHES}). Giving up.")

    if target_folder.exists():
        remaining = collect_pending_items(target_folder)
        if remaining:
            log(
                f"WARNING: {len(remaining)} prompt(s) still pending after {MAX_CRASHES} crashes."
            )


# ── Daemon ──────────────────────────────────────────────────────────────────


def daemonize() -> None:
    """Double-fork to detach from terminal. stderr → log file (not /dev/null)."""
    pid = os.fork()
    if pid > 0:
        sys.exit(0)

    os.setsid()

    pid = os.fork()
    if pid > 0:
        sys.exit(0)

    sys.stdout.flush()
    sys.stderr.flush()

    # stdin → /dev/null
    devnull = os.open(os.devnull, os.O_RDWR)
    os.dup2(devnull, 0)
    os.close(devnull)

    # stdout + stderr → log file (so Python tracebacks are captured)
    log_fd = os.open(str(LOG_FILE), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(log_fd, 1)
    os.dup2(log_fd, 2)
    os.close(log_fd)


def setup_signals() -> None:
    """Install signal handlers for graceful shutdown."""

    def handle_sigterm(signum, frame):  # pragma: no cover
        log(f"Received signal {signum}, shutting down.")
        remove_pid()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)


# ── Job Store (schedule + cron persistence) ─────────────────────────────────
#
# Single JSON document at JOBS_FILE. Writes are atomic: we serialize to a
# sibling ".tmp" file with fsync, then os.replace() to the target path.
# Reads tolerate a missing file (returns the empty-store skeleton) and a
# corrupted file (logs to stderr, returns the empty skeleton — the operator
# can recover from .prompt_executor_jobs.json.bak which we also write).
#
# Schema:
#   {
#     "version": 1,
#     "schedules": [ <schedule_job>, ... ],
#     "crons":     [ <cron_job>, ... ]
#   }
#
# A schedule_job has: id, folder, model, agent, period, max_retries,
# retry_wait, working_dir, at_iso, created_at_iso.
# A cron_job additionally has: expr, last_run_iso, next_run_iso.

JOB_STORE_VERSION = 1


def _empty_store() -> dict:
    return {"version": JOB_STORE_VERSION, "schedules": [], "crons": []}


def _make_job_id(prefix: str) -> str:
    """Time-prefixed, lexicographically-sortable, URL-safe ID."""
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    rand = secrets.token_hex(4)
    return f"{prefix}_{ts}_{rand}"


class JobStore:
    """
    Atomic JSON-backed job persistence. Instances are cheap — always
    construct fresh before read/modify/write cycles (the daemon re-reads
    on every tick so operator adds/removes take effect without a restart).
    """

    def __init__(self, path: Path = JOBS_FILE) -> None:
        self.path = path

    def read(self) -> dict:
        if not self.path.exists():
            return _empty_store()
        try:
            raw = self.path.read_text(encoding="utf-8")
        except OSError as e:
            print(
                f"[prompt_executor] WARNING: failed to read {self.path}: {e}",
                file=sys.stderr,
            )
            return _empty_store()
        if not raw.strip():
            return _empty_store()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            backup = self.path.with_suffix(self.path.suffix + ".corrupt")
            try:
                self.path.rename(backup)
            except OSError:
                pass
            print(
                f"[prompt_executor] WARNING: corrupt job store "
                f"({e}); moved to {backup}. Starting fresh.",
                file=sys.stderr,
            )
            return _empty_store()
        # Be forgiving about minor schema drift.
        if not isinstance(data, dict):
            return _empty_store()
        data.setdefault("version", JOB_STORE_VERSION)
        data.setdefault("schedules", [])
        data.setdefault("crons", [])
        return data

    def write(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        body = json.dumps(data, indent=2, sort_keys=True)
        # Atomic: write tmp → fsync → rename.
        with tmp.open("w", encoding="utf-8") as f:
            f.write(body)
            f.flush()
            try:
                os.fsync(f.fileno())
            except OSError:
                pass
        os.replace(tmp, self.path)

    # ── Convenience mutators (read / modify / write cycles) ──────────────

    def add_schedule(self, job: dict) -> dict:
        data = self.read()
        data["schedules"].append(job)
        self.write(data)
        return job

    def add_cron(self, job: dict) -> dict:
        data = self.read()
        data["crons"].append(job)
        self.write(data)
        return job

    def remove(self, job_id: str) -> bool:
        """Remove a job by ID from either list. Returns True if found."""
        data = self.read()
        before = len(data["schedules"]) + len(data["crons"])
        data["schedules"] = [j for j in data["schedules"] if j.get("id") != job_id]
        data["crons"] = [j for j in data["crons"] if j.get("id") != job_id]
        after = len(data["schedules"]) + len(data["crons"])
        if after != before:
            self.write(data)
            return True
        return False

    def update_cron_run(
        self, job_id: str, last_run_iso: str, next_run_iso: str
    ) -> None:
        data = self.read()
        for j in data["crons"]:
            if j.get("id") == job_id:
                j["last_run_iso"] = last_run_iso
                j["next_run_iso"] = next_run_iso
                break
        self.write(data)

    def remove_schedule(self, job_id: str) -> None:
        data = self.read()
        data["schedules"] = [j for j in data["schedules"] if j.get("id") != job_id]
        self.write(data)


# ── Cron Expression Parser ──────────────────────────────────────────────────
#
# A minimal, dependency-free 5-field cron parser supporting:
#   *        — every value
#   N        — single integer
#   N,M,P    — comma-separated list
#   N-M      — inclusive range
#   N-M/S    — range with step
#   */S      — every S values starting from the minimum of the range
#
# Fields (order matches POSIX cron):
#   minute       0-59
#   hour         0-23
#   day-of-month 1-31
#   month        1-12
#   day-of-week  0-6    (0 = Sunday)
#
# No named aliases (@hourly, JAN, MON, ...) — those are out of scope for
# the minimal parser. next_fire_after(dt) returns the next datetime
# strictly greater than dt that matches the expression, in local time.


_CRON_RANGES = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 6)]
_CRON_FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"]


def _parse_cron_field(field: str, lo: int, hi: int, name: str) -> set[int]:
    """Expand a single cron field into the set of matching integers."""
    out: set[int] = set()
    for part in field.split(","):
        part = part.strip()
        if not part:
            raise ValueError(f"empty component in {name} field: {field!r}")
        step = 1
        if "/" in part:
            base, _, step_s = part.partition("/")
            try:
                step = int(step_s)
            except ValueError:
                raise ValueError(f"bad step in {name}: {part!r}")
            if step < 1:
                raise ValueError(f"step must be >= 1 in {name}: {part!r}")
        else:
            base = part
        if base == "*":
            start, end = lo, hi
        elif "-" in base:
            a, _, b = base.partition("-")
            try:
                start, end = int(a), int(b)
            except ValueError:
                raise ValueError(f"bad range in {name}: {base!r}")
        else:
            try:
                start = end = int(base)
            except ValueError:
                raise ValueError(f"bad value in {name}: {base!r}")
        if start < lo or end > hi or start > end:
            raise ValueError(
                f"{name} value out of range [{lo},{hi}]: {base!r}"
            )
        for v in range(start, end + 1, step):
            out.add(v)
    if not out:
        raise ValueError(f"{name} field produced no values: {field!r}")
    return out


def parse_cron_expr(expr: str) -> dict:
    """
    Parse a 5-field cron expression. Returns a dict with per-field sets:
        {"minute": {...}, "hour": {...}, "dom": {...},
         "month": {...}, "dow": {...}}
    Raises ValueError on any malformed field.
    """
    parts = expr.split()
    if len(parts) != 5:
        raise ValueError(
            f"cron expression must have exactly 5 fields "
            f"(minute hour dom month dow), got {len(parts)}: {expr!r}"
        )
    field_sets = [
        _parse_cron_field(parts[i], lo, hi, _CRON_FIELD_NAMES[i])
        for i, (lo, hi) in enumerate(_CRON_RANGES)
    ]
    return {
        "minute": field_sets[0],
        "hour": field_sets[1],
        "dom": field_sets[2],
        "month": field_sets[3],
        "dow": field_sets[4],
    }


def next_fire_after(expr: str | dict, after: datetime) -> datetime:
    """
    Return the earliest datetime strictly > `after` that matches `expr`.

    Standard POSIX cron semantics: when BOTH dom and dow are restricted
    (not "*"), the match is the union — either matching dom OR matching
    dow triggers the job. When only one is restricted, only that one
    applies. This matches crontab(5) on Linux / BSD.

    Search is bounded to 4 * 366 * 24 * 60 minutes (~4 years) to guarantee
    termination for impossible combinations like "0 0 30 2 *".
    """
    fields = expr if isinstance(expr, dict) else parse_cron_expr(expr)
    # Start from the next minute boundary after `after`.
    cand = (after + timedelta(minutes=1)).replace(second=0, microsecond=0)
    # Detect whether dom / dow are restricted (compared to full ranges).
    dom_full = fields["dom"] == set(range(1, 32))
    dow_full = fields["dow"] == set(range(0, 7))
    for _ in range(4 * 366 * 24 * 60):
        if cand.month not in fields["month"]:
            # Jump to first day of next month.
            if cand.month == 12:
                cand = cand.replace(year=cand.year + 1, month=1, day=1, hour=0, minute=0)
            else:
                cand = cand.replace(month=cand.month + 1, day=1, hour=0, minute=0)
            continue
        # Day-of-month / day-of-week matching.
        # crontab(5): when both restricted → union; otherwise intersection.
        python_dow = (cand.weekday() + 1) % 7  # Mon=0..Sun=6 → Sun=0..Sat=6
        dom_ok = cand.day in fields["dom"]
        dow_ok = python_dow in fields["dow"]
        if dom_full and dow_full:
            day_ok = True
        elif dom_full:
            day_ok = dow_ok
        elif dow_full:
            day_ok = dom_ok
        else:
            day_ok = dom_ok or dow_ok
        if not day_ok:
            cand = (cand + timedelta(days=1)).replace(hour=0, minute=0)
            continue
        if cand.hour not in fields["hour"]:
            cand = (cand + timedelta(hours=1)).replace(minute=0)
            continue
        if cand.minute not in fields["minute"]:
            cand = cand + timedelta(minutes=1)
            continue
        return cand
    raise ValueError(f"cron expression never fires within 4 years: {expr!r}")


# ── Duration Parser (for --in) ──────────────────────────────────────────────
#
# Accepts "2h30m", "45m", "90s", "1d", "1h5m10s", "1.5h" (floats are
# rounded to the nearest second). At least one unit is required.

_DURATION_RE = re.compile(
    r"^\s*(?:(\d+(?:\.\d+)?)d)?\s*"
    r"(?:(\d+(?:\.\d+)?)h)?\s*"
    r"(?:(\d+(?:\.\d+)?)m)?\s*"
    r"(?:(\d+(?:\.\d+)?)s)?\s*$",
    re.IGNORECASE,
)


def parse_duration(s: str) -> timedelta:
    """Parse '2h30m' style strings into a timedelta. Raises ValueError."""
    if not s or not s.strip():
        raise ValueError("empty duration")
    m = _DURATION_RE.match(s)
    if not m or not any(m.groups()):
        raise ValueError(
            f"bad duration: {s!r} "
            f"(expected combinations of Nd/Nh/Nm/Ns, e.g. '2h30m')"
        )
    days, hours, mins, secs = m.groups()
    total = 0.0
    if days:
        total += float(days) * 86400
    if hours:
        total += float(hours) * 3600
    if mins:
        total += float(mins) * 60
    if secs:
        total += float(secs)
    if total <= 0:
        raise ValueError(f"duration must be positive: {s!r}")
    return timedelta(seconds=round(total))


# ── Failure Classifier + Doctor ─────────────────────────────────────────────
#
# Extends the existing _classify_stderr() (which recognises MCP_ERROR and
# SKILL_ERROR) with additional categories. The doctor command groups log
# + _failures.log entries by prompt path, classifies each failure, and
# writes .prompt_executor_{slug}_fixplan.md with per-prompt recommendations.
#
# Categories (most specific first):
#   MCP_ERROR       — MCP server failures, timeouts, auth issues
#   SKILL_ERROR     — skill not found, validation failures, permission denied
#   RATE_LIMIT      — 429 / "rate limit"
#   QUOTA           — "quota exceeded" / "insufficient_quota"
#   AUTH            — 401/403 / "invalid api key"
#   TIMEOUT         — subprocess TimeoutExpired / elapsed >= TIMEOUT_SECONDS
#   UNRECOVERABLE   — matches the existing unrecoverable skip list
#   EXTERNAL        — DNS failures / 5xx from provider
#   TRANSIENT       — default (covered by --max-retries)

DOCTOR_CATEGORY_MCP = "MCP_ERROR"
DOCTOR_CATEGORY_SKILL = "SKILL_ERROR"
DOCTOR_CATEGORY_RATE_LIMIT = "RATE_LIMIT"
DOCTOR_CATEGORY_QUOTA = "QUOTA"
DOCTOR_CATEGORY_AUTH = "AUTH"
DOCTOR_CATEGORY_TIMEOUT = "TIMEOUT"
DOCTOR_CATEGORY_UNRECOVERABLE = "UNRECOVERABLE"
DOCTOR_CATEGORY_EXTERNAL = "EXTERNAL"
DOCTOR_CATEGORY_TRANSIENT = "TRANSIENT"

_DOCTOR_RECOMMENDATIONS = {
    DOCTOR_CATEGORY_MCP: (
        "MCP server error. Run the `mcp-manager` skill "
        "or `mcp__context-mode__doctor` to diagnose. Restart the affected "
        "MCP server before re-running this prompt."
    ),
    DOCTOR_CATEGORY_SKILL: (
        "Skill not found or invalid. Re-run "
        "`scripts/validate_skills.py` and confirm the skill is installed "
        "under `.opencode/` or `.claude/skills/`. Fix by hand — never "
        "edit the prompt silently."
    ),
    DOCTOR_CATEGORY_RATE_LIMIT: (
        "Provider rate-limited the request. Bump `--retry-wait` "
        "(default 10 min) or switch to a cheaper/faster model "
        "(flash / haiku) for this folder."
    ),
    DOCTOR_CATEGORY_QUOTA: (
        "Account quota exhausted. Skip this prompt, top up "
        "credits in the provider dashboard, then re-queue."
    ),
    DOCTOR_CATEGORY_AUTH: (
        "Authentication failed. Verify ZAI_API_KEY / "
        "ANTHROPIC_API_KEY in the root .env. Do NOT check keys into git."
    ),
    DOCTOR_CATEGORY_TIMEOUT: (
        "Subprocess exceeded the per-prompt timeout "
        "(default 1 h). Split the prompt into smaller phases or raise "
        "TIMEOUT_SECONDS."
    ),
    DOCTOR_CATEGORY_UNRECOVERABLE: (
        "Already flagged as unrecoverable by the executor "
        "(autocompact thrashing, missing model, etc.). Edit the prompt or "
        "pick a different model."
    ),
    DOCTOR_CATEGORY_EXTERNAL: (
        "External service degraded (DNS / 5xx / connection "
        "refused). Wait it out — not an executor bug."
    ),
    DOCTOR_CATEGORY_TRANSIENT: (
        "Transient error — already handled by the normal "
        "`--max-retries` loop. No action needed unless the failure count "
        "is unusually high."
    ),
}


def _classify_failure_reason(
    stderr: str | None,
    exit_code: int | None = None,
    elapsed_s: float | None = None,
) -> str:
    """
    Extended classifier used by the doctor. Returns one of the
    DOCTOR_CATEGORY_* constants. Never returns None — defaults to
    TRANSIENT so every failure gets a recommendation.
    """
    s = (stderr or "").lower()

    # Timeouts first (explicit signal), before any pattern matching.
    if "timeoutexpired" in s or "timed out" in s:
        return DOCTOR_CATEGORY_TIMEOUT
    if elapsed_s is not None and elapsed_s >= TIMEOUT_SECONDS:
        return DOCTOR_CATEGORY_TIMEOUT

    # Existing MCP / skill patterns (reuse the module-level classifier).
    existing = _classify_stderr(stderr or "")
    if existing == "MCP_ERROR":
        return DOCTOR_CATEGORY_MCP
    if existing == "SKILL_ERROR":
        return DOCTOR_CATEGORY_SKILL

    # Rate-limit / quota / auth — string contains is enough; we're not
    # trying to match every possible phrasing.
    if "rate limit" in s or "rate-limit" in s or "429 too many" in s:
        return DOCTOR_CATEGORY_RATE_LIMIT
    if "quota" in s or "insufficient_quota" in s or "exceeded quota" in s:
        return DOCTOR_CATEGORY_QUOTA
    if (
        "invalid api key" in s
        or "authentication failed" in s
        or "unauthori" in s  # covers unauthorised / unauthorized
        or "401 " in s
        or "403 " in s
    ):
        return DOCTOR_CATEGORY_AUTH

    # Unrecoverable keywords the executor itself already flags.
    if (
        "autocompact is thrashing" in s
        or "providermodelnotfounderror" in s
        or "no such model" in s
    ):
        return DOCTOR_CATEGORY_UNRECOVERABLE

    # External / infrastructure.
    if (
        "name or service not known" in s
        or "temporary failure in name resolution" in s
        or "connection refused" in s
        or "connection reset" in s
        or "502 bad gateway" in s
        or "503 service unavailable" in s
        or "504 gateway timeout" in s
    ):
        return DOCTOR_CATEGORY_EXTERNAL

    return DOCTOR_CATEGORY_TRANSIENT


# Failure log format (see log_failure at line ~600):
#   [iso-timestamp] SKIPPED: <path>  attempts=<n>  last_error=<...>
# Each entry is one line. The doctor parses these to reconstruct a map
# prompt_path -> (attempts, last_error).
_FAILURE_LINE_RE = re.compile(
    r"^\[(?P<ts>[^\]]+)\]\s*SKIPPED:\s*(?P<path>[^\s]+)\s+"
    r"attempts=(?P<attempts>\d+)\s+last_error=(?P<err>.*)$"
)


def _parse_failure_log(path: Path) -> list[dict]:
    """Parse a failures log into a list of dicts. Missing file → []."""
    if not path.exists():
        return []
    out: list[dict] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    for line in text.splitlines():
        m = _FAILURE_LINE_RE.match(line.strip())
        if not m:
            continue
        out.append(
            {
                "ts": m.group("ts"),
                "path": m.group("path"),
                "attempts": int(m.group("attempts")),
                "last_error": m.group("err"),
            }
        )
    return out


def _generate_fix_plan(slug: str, failures: list[dict]) -> str:
    """Render a markdown fix-plan for the given slug + failures list."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines: list[str] = [
        f"# Prompt Executor Doctor Report — {slug}",
        "",
        f"Generated: {ts}",
        f"Failures analyzed: {len(failures)}",
        "",
        "This file is **advisory only**. The executor never edits prompts "
        "or `prompt_executor.py` itself — apply the recommendations by hand.",
        "",
    ]
    if not failures:
        lines.append("No skipped prompts found. Nothing to fix.")
        return "\n".join(lines) + "\n"

    # Aggregate by category first, so the operator sees the shape of the
    # problem before drilling into individual prompts.
    by_category: dict[str, list[dict]] = {}
    for f in failures:
        cat = _classify_failure_reason(f.get("last_error", ""))
        f["_category"] = cat
        by_category.setdefault(cat, []).append(f)

    lines.append("## Category summary")
    lines.append("")
    lines.append("| Category | Count | Recommendation |")
    lines.append("|---|---|---|")
    for cat in sorted(by_category.keys()):
        count = len(by_category[cat])
        rec = _DOCTOR_RECOMMENDATIONS.get(cat, "").split(".")[0]
        lines.append(f"| `{cat}` | {count} | {rec} |")
    lines.append("")
    lines.append("## Per-prompt detail")
    lines.append("")
    for f in failures:
        cat = f["_category"]
        rec = _DOCTOR_RECOMMENDATIONS.get(cat, "")
        lines.append(f"### `{f['path']}`")
        lines.append("")
        lines.append(f"- **Category:** `{cat}`")
        lines.append(f"- **Attempts:** {f['attempts']}")
        lines.append(f"- **Last error:** `{f['last_error']}`")
        lines.append(f"- **Timestamp:** {f['ts']}")
        lines.append(f"- **Recommendation:** {rec}")
        lines.append("")
    return "\n".join(lines) + "\n"


def run_doctor(target_folder: Path | None) -> Path | None:
    """
    Run the doctor against one folder (or, if target_folder is None,
    every failures log in SCRIPT_DIR). Writes a .prompt_executor_{slug}
    _fixplan.md next to the failures log and returns the fix-plan path
    (or None if no failures logs exist).
    """
    if target_folder is None:
        failure_files = sorted(SCRIPT_DIR.glob(".prompt_executor_*_failures.log"))
    else:
        slug = target_folder.name
        failure_files = [SCRIPT_DIR / f".prompt_executor_{slug}_failures.log"]
    written: list[Path] = []
    for ff in failure_files:
        if not ff.exists():
            continue
        slug = ff.stem.replace(".prompt_executor_", "").replace("_failures", "")
        failures = _parse_failure_log(ff)
        report = _generate_fix_plan(slug, failures)
        out_path = SCRIPT_DIR / f".prompt_executor_{slug}_fixplan.md"
        out_path.write_text(report, encoding="utf-8")
        written.append(out_path)
    return written[0] if written else None


# ── Scheduler Daemon ────────────────────────────────────────────────────────
#
# Long-lived background process that owns the schedule/cron job store.
# Reads the store on every tick (so adds/removes take effect live), fires
# any due jobs by Popen-ing "prompt_executor.py run ..." as a subprocess,
# then sleeps SCHEDULER_TICK_SECONDS.
#
# One-shot schedules are deleted from the store immediately after they
# fire so they never run twice — even if the daemon crashes mid-tick,
# worst case the job fires a second time on recovery (idempotency is up
# to the prompt author).
#
# Cron jobs update last_run_iso / next_run_iso in place and stay in the
# store forever (until explicitly removed via `cron remove`).


def _spawn_run(
    folder: str,
    model: str,
    agent: str | None,
    period: int,
    max_retries: int,
    retry_wait: int,
    working_dir: str | None,
) -> int:
    """
    Fire off a single `prompt_executor.py run` subprocess. Returns the
    child PID. The subprocess inherits our env (so ZAI_API_KEY etc. flow
    through), its stdout/stderr are redirected to the per-folder log via
    the `run` command's own logging.
    """
    cmd: list[str] = [
        sys.executable,
        str(Path(__file__).resolve()),
        "run",
        folder,
        "--model",
        model,
        "--period",
        str(period),
        "--max-retries",
        str(max_retries),
        "--retry-wait",
        str(retry_wait),
    ]
    if agent:
        cmd.extend(["--agent", agent])
    if working_dir:
        cmd.extend(["--working-dir", working_dir])
    # Detach so the child survives if the scheduler daemon exits.
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return proc.pid


def _scheduler_log(msg: str) -> None:
    """Write to the scheduler's own log file (fsync'd)."""
    SCHEDULER_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    with SCHEDULER_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(line)
        f.flush()
        try:
            os.fsync(f.fileno())
        except OSError:
            pass


def _scheduler_is_running() -> bool:
    """True if the scheduler daemon's PID file points at a live process."""
    pid = _read_pid_from_file(SCHEDULER_PID_FILE)
    if not pid:
        return False
    return _pid_alive(pid)


def _scheduler_tick(now: datetime | None = None) -> int:
    """
    Single scheduler pass. Returns the number of jobs fired.

    Exposed at module level so tests can drive it deterministically with
    a frozen `now`.
    """
    if now is None:
        now = datetime.now()
    store = JobStore()
    data = store.read()
    fired = 0

    # One-shot schedules: fire every job whose at_iso <= now, then remove.
    remaining_schedules: list[dict] = []
    for job in data.get("schedules", []):
        try:
            at = datetime.fromisoformat(job["at_iso"])
        except (KeyError, ValueError):
            _scheduler_log(f"ERROR: schedule {job.get('id')} has bad at_iso; dropping.")
            continue
        if at <= now:
            try:
                pid = _spawn_run(
                    job["folder"],
                    job["model"],
                    job.get("agent"),
                    int(job.get("period", WAIT_MINUTES)),
                    int(job.get("max_retries", MAX_RETRIES)),
                    int(job.get("retry_wait", RETRY_WAIT_MINUTES)),
                    job.get("working_dir"),
                )
                _scheduler_log(
                    f"FIRED schedule {job['id']} → pid {pid} "
                    f"folder={job['folder']} model={job['model']}"
                )
                fired += 1
            except Exception as e:  # pragma: no cover — defensive
                _scheduler_log(f"ERROR firing schedule {job.get('id')}: {e}")
                remaining_schedules.append(job)
        else:
            remaining_schedules.append(job)
    data["schedules"] = remaining_schedules

    # Cron jobs: fire when next_run_iso <= now, then advance next_run_iso.
    for job in data.get("crons", []):
        expr = job.get("expr")
        if not expr:
            continue
        next_run_iso = job.get("next_run_iso")
        if not next_run_iso:
            # Freshly added, compute from scratch.
            try:
                job["next_run_iso"] = next_fire_after(expr, now).isoformat()
            except ValueError:
                _scheduler_log(
                    f"ERROR: cron {job.get('id')} has bad expr {expr!r}; dropping next_run."
                )
            continue
        try:
            due = datetime.fromisoformat(next_run_iso)
        except ValueError:
            _scheduler_log(
                f"ERROR: cron {job.get('id')} has bad next_run_iso; recomputing."
            )
            job["next_run_iso"] = next_fire_after(expr, now).isoformat()
            continue
        if due <= now:
            try:
                pid = _spawn_run(
                    job["folder"],
                    job["model"],
                    job.get("agent"),
                    int(job.get("period", WAIT_MINUTES)),
                    int(job.get("max_retries", MAX_RETRIES)),
                    int(job.get("retry_wait", RETRY_WAIT_MINUTES)),
                    job.get("working_dir"),
                )
                job["last_run_iso"] = now.isoformat()
                job["next_run_iso"] = next_fire_after(expr, now).isoformat()
                _scheduler_log(
                    f"FIRED cron {job['id']} → pid {pid} "
                    f"folder={job['folder']} next={job['next_run_iso']}"
                )
                fired += 1
            except Exception as e:  # pragma: no cover — defensive
                _scheduler_log(f"ERROR firing cron {job.get('id')}: {e}")
    store.write(data)
    return fired


def _scheduler_main_loop() -> None:
    """Wake every SCHEDULER_TICK_SECONDS, fire due jobs, repeat forever."""
    _scheduler_log(
        f"scheduler-daemon started (tick={SCHEDULER_TICK_SECONDS}s, "
        f"jobs={JOBS_FILE})"
    )
    while True:
        try:
            fired = _scheduler_tick()
            if fired:
                _scheduler_log(f"tick complete, fired {fired} job(s)")
        except Exception as e:
            _scheduler_log(f"CRASH in tick: {type(e).__name__}: {e}")
            _scheduler_log(tb_module.format_exc())
        time.sleep(SCHEDULER_TICK_SECONDS)


def _start_scheduler_daemon_if_needed() -> None:
    """
    Idempotent: no-op if the scheduler daemon is already running. Else
    spawn ourselves with `scheduler-daemon` and return once the child has
    daemonized. Used by `schedule` / `cron` add paths so the operator
    never has to think about the daemon lifecycle.
    """
    if _scheduler_is_running():
        return
    # Clean stale PID file, then spawn.
    if SCHEDULER_PID_FILE.exists():
        try:
            SCHEDULER_PID_FILE.unlink()
        except OSError:
            pass
    cmd = [sys.executable, str(Path(__file__).resolve()), "scheduler-daemon"]
    subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    # Wait briefly for PID file to appear so `status` immediately reflects it.
    for _ in range(20):
        if _scheduler_is_running():
            return
        time.sleep(0.1)


# ── Commands ────────────────────────────────────────────────────────────────


def cmd_start(args: argparse.Namespace) -> None:
    target = resolve_target_folder(args.folder)
    slug = init_runtime_files(target)
    backend = detect_backend(args.model)
    agent = getattr(args, "agent", None)
    working_dir = getattr(args, "working_dir", None) or PROJECT_ROOT

    existing = read_pid()
    if existing:
        print(f"Already running for [{slug}] (PID {existing}). Stop it first.")
        sys.exit(1)

    clean_stale_pid()
    assert_no_duplicate_executor(target)

    print(f"Starting prompt executor daemon [{slug}]...")
    print(f"  Target: {target}")
    print(f"  Backend: {backend}  Model: {args.model}")
    if agent:
        print(f"  Agent: {agent}")
    print(
        f"  wait={args.period}m  retries={args.max_retries}  retry_wait={args.retry_wait}m"
    )
    print(f"  PID file: {PID_FILE}")
    print(f"  Log: {LOG_FILE}")
    print(f"  Failures: {FAILURES_FILE}")

    daemonize()
    install_crash_handlers()
    setup_signals()
    log(
        f"Daemon started [{slug}] (PID {os.getpid()}, target={target}, backend={backend}, model={args.model}, agent={agent}, wait={args.period}m, retries={args.max_retries})"
    )
    write_pid(os.getpid())

    resilient_run(
        target,
        args.period,
        args.max_retries,
        args.retry_wait,
        args.model,
        backend,
        agent=agent,
        working_dir=working_dir,
    )

    remove_pid()
    log("Daemon finished — all work complete or max crashes reached.")


def cmd_run(args: argparse.Namespace) -> None:
    """Run in foreground (no daemonization)."""
    target = resolve_target_folder(args.folder)
    slug = init_runtime_files(target)
    backend = detect_backend(args.model)
    agent = getattr(args, "agent", None)
    working_dir = getattr(args, "working_dir", None) or PROJECT_ROOT

    existing = read_pid()
    if existing:
        print(f"Already running for [{slug}] (PID {existing}). Stop it first.")
        sys.exit(1)

    clean_stale_pid()
    assert_no_duplicate_executor(target)

    pending = collect_pending_items(target)

    print(f"Running prompt executor in foreground [{slug}]...")
    print(f"  Target: {target}")
    print(f"  Backend: {backend}  Model: {args.model}")
    if agent:
        print(f"  Agent: {agent}")
    print(f"  Pending: {len(pending)} prompt(s)")
    print(
        f"  wait={args.period}m  retries={args.max_retries}  retry_wait={args.retry_wait}m"
    )
    print(f"  PID file: {PID_FILE}")
    print(f"  Log: {LOG_FILE}")
    print(f"  Failures: {FAILURES_FILE}")

    if not pending:
        print("\n  No pending prompts found. Nothing to do.")
        return

    print(f"\n  Execution order:")
    for i, p in enumerate(pending, 1):
        try:
            rel = p.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = p
        print(f"    {i:3d}. {rel}")
    print()

    install_crash_handlers()
    setup_signals()
    log(
        f"Foreground run started (PID {os.getpid()}, target={target}, backend={backend}, model={args.model}, agent={agent}, wait={args.period}m, retries={args.max_retries})"
    )

    resilient_run(
        target,
        args.period,
        args.max_retries,
        args.retry_wait,
        args.model,
        backend,
        agent=agent,
        working_dir=working_dir,
    )

    log("Foreground run finished.")


def _pid_alive(pid: int) -> bool:
    """True if PID is still running."""
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but we cannot signal it — still "alive" for our purposes.
        return True


def _sweep_descendants(root_pids: set[int]) -> int:
    """
    Walk /proc looking for any process whose PPid chain leads back to one of
    ``root_pids`` and SIGKILL it. Returns the number of survivors killed.

    This catches stragglers that escaped killpg — e.g. grandchildren that
    called setsid() themselves, or processes whose parent already died so
    they were reparented to init but still reference our original PPid in
    their own transitive chain.
    """
    killed = 0
    try:
        proc_entries = list(Path("/proc").iterdir())
    except OSError:
        return 0

    # Build ppid map for transitive parentage check.
    ppid_map: dict[int, int] = {}
    for entry in proc_entries:
        if not entry.name.isdigit():
            continue
        try:
            status = (entry / "status").read_text(errors="ignore")
        except OSError:
            continue
        for line in status.splitlines():
            if line.startswith("PPid:"):
                try:
                    ppid_map[int(entry.name)] = int(line.split()[1])
                except (ValueError, IndexError):
                    pass
                break

    def _traces_to_root(pid: int) -> bool:
        seen: set[int] = set()
        cur = pid
        while cur not in seen:
            seen.add(cur)
            parent = ppid_map.get(cur)
            if parent is None or parent == 0 or parent == 1:
                return False
            if parent in root_pids:
                return True
            cur = parent
        return False

    for pid, _ppid in ppid_map.items():
        if pid in root_pids:
            continue
        if _traces_to_root(pid):
            try:
                os.kill(pid, signal.SIGKILL)
                killed += 1
            except (ProcessLookupError, PermissionError):
                pass
    return killed


def _stop_pid_file(pid_file: Path) -> bool:
    """
    Stop the instance tracked by a PID file and ALL of its descendants.

    Strategy:
      1. Look up the daemon's process group (PGID). The daemon called
         ``os.setsid()`` during daemonization so PGID == PID in the normal
         case. Fall back to the PID if getpgid fails.
      2. Send SIGTERM to the whole process group via ``killpg``. This
         reaches the daemon and any in-flight ``claude`` / ``opencode``
         subprocess it spawned.
      3. Wait up to 10 seconds for graceful exit.
      4. Any survivor in the group gets SIGKILL via ``killpg``.
      5. As a final safety net, walk /proc and SIGKILL any process whose
         PPid chain still traces back to the daemon (catches grandchildren
         that set up their own session).

    Returns True if we found and acted on a live PID.
    """
    pid = _read_pid_from_file(pid_file)
    if not pid:
        try:
            pid_file.unlink()
        except FileNotFoundError:
            pass
        return False

    slug = pid_file.stem.replace(".prompt_executor_", "")
    print(f"  Stopping [{slug}] (PID {pid})...")

    try:
        pgid = os.getpgid(pid)
    except ProcessLookupError:
        pgid = pid
    except PermissionError:
        pgid = pid

    # 1) Polite: SIGTERM the whole process group.
    def _signal_group(sig: int) -> None:
        try:
            os.killpg(pgid, sig)
        except ProcessLookupError:
            pass
        except PermissionError:
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                pass

    _signal_group(signal.SIGTERM)

    # 2) Wait up to 10 seconds for graceful exit.
    for _ in range(20):
        if not _pid_alive(pid):
            break
        time.sleep(0.5)

    # 3) Hard kill any survivor in the group.
    if _pid_alive(pid):
        print(f"  [{slug}] did not exit within 10s, sending SIGKILL...")
        _signal_group(signal.SIGKILL)
        for _ in range(10):
            if not _pid_alive(pid):
                break
            time.sleep(0.2)

    # 4) Safety net: sweep /proc for any descendants still tracing to us.
    root_pids = {pid}
    if pgid and pgid != pid:
        root_pids.add(pgid)
    stragglers = _sweep_descendants(root_pids)
    if stragglers:
        print(f"  [{slug}] killed {stragglers} straggler descendant(s).")

    try:
        pid_file.unlink()
    except FileNotFoundError:
        pass

    if _pid_alive(pid):
        print(f"  WARNING: [{slug}] (PID {pid}) is still alive after SIGKILL.")
    else:
        print(f"  Stopped [{slug}].")
    return True


def _confirm_stop_plan(
    pid_files: list[Path],
    schedules: list[dict],
    crons: list[dict],
    auto_yes: bool,
) -> bool:
    """
    Print the 'what's about to be stopped' plan and prompt for confirmation.

    Returns True if the user approved (or auto_yes is set).
    """
    print("Found:")
    if pid_files:
        slugs = [pf.stem.replace(".prompt_executor_", "") for pf in pid_files]
        print(f"  Running   : {len(pid_files)} instance(s)   [{', '.join(slugs)}]")
    else:
        print("  Running   : 0")
    if schedules:
        first = schedules[0]
        label = (
            f"{first.get('id')}: {first.get('folder')} "
            f"at {first.get('at_iso')}"
        )
        extra = "" if len(schedules) == 1 else f" (+{len(schedules) - 1} more)"
        print(f"  Scheduled : {len(schedules)} one-shot      [{label}{extra}]")
    else:
        print("  Scheduled : 0")
    if crons:
        first = crons[0]
        label = (
            f"{first.get('id')}: {first.get('folder')} "
            f"every \"{first.get('expr')}\""
        )
        extra = "" if len(crons) == 1 else f" (+{len(crons) - 1} more)"
        print(f"  Cron      : {len(crons)} recurring     [{label}{extra}]")
    else:
        print("  Cron      : 0")

    if auto_yes:
        print("--yes supplied, proceeding without prompt.")
        return True

    running_part = f"stop {len(pid_files)} running"
    sched_part = f"disable {len(schedules)} scheduled" if schedules else ""
    cron_part = f"disable {len(crons)} cron" if crons else ""
    parts = [p for p in (running_part, sched_part, cron_part) if p]
    question = " + ".join(parts) + "? [y/N]: "
    try:
        reply = input(question).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    return reply in ("y", "yes")


def _gather_all_running_pid_files() -> list[Path]:
    """Every .pid file in SCRIPT_DIR, including the scheduler."""
    return sorted(SCRIPT_DIR.glob(".prompt_executor_*.pid"))


def cmd_stop(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)
    auto_yes = bool(getattr(args, "yes", False))
    running_only = bool(getattr(args, "running_only", False))
    scheduled_only = bool(getattr(args, "scheduled_only", False))
    cron_only = bool(getattr(args, "cron_only", False))

    # Mutually exclusive scope flags — argparse already enforces, but we
    # keep a defensive check in case callers construct argparse.Namespace
    # by hand (tests do).
    scope_flags = sum(
        [
            1 if running_only else 0,
            1 if scheduled_only else 0,
            1 if cron_only else 0,
        ]
    )
    if scope_flags > 1:
        print("ERROR: --running-only / --scheduled-only / --cron-only are mutually exclusive.")
        return

    store = JobStore()
    store_data = store.read()
    schedules = store_data.get("schedules", [])
    crons = store_data.get("crons", [])

    if folder_arg:
        # Legacy single-folder path: stop the running instance, and if the
        # folder ALSO has a scheduled or cron job, confirm before removing.
        target = resolve_target_folder(folder_arg)
        slug = target.name
        init_runtime_files(target)
        pid = read_pid()

        matching_schedules = [j for j in schedules if Path(j.get("folder", "")).name == slug]
        matching_crons = [j for j in crons if Path(j.get("folder", "")).name == slug]

        stopped_anything = False

        # Running process.
        if pid and not (scheduled_only or cron_only):
            _stop_pid_file(PID_FILE)
            stopped_anything = True
        elif not pid and not (scheduled_only or cron_only):
            print(f"Not running for [{slug}].")
            clean_stale_pid()

        # Scheduled / cron deletions for this folder need confirmation.
        if matching_schedules and not (running_only or cron_only):
            if auto_yes or _confirm_stop_plan(
                [], matching_schedules, [], auto_yes
            ):
                for j in matching_schedules:
                    store.remove_schedule(j["id"])
                    print(f"  Removed schedule {j['id']}.")
                    stopped_anything = True
        if matching_crons and not (running_only or scheduled_only):
            if auto_yes or _confirm_stop_plan(
                [], [], matching_crons, auto_yes
            ):
                for j in matching_crons:
                    store.remove(j["id"])
                    print(f"  Removed cron {j['id']}.")
                    stopped_anything = True

        if not stopped_anything:
            print(f"Nothing to stop for [{slug}].")
        return

    # No folder arg — global scope.
    pid_files = _gather_all_running_pid_files()

    # Filter each list by the --*-only scope.
    do_running = not (scheduled_only or cron_only)
    do_scheduled = not (running_only or cron_only)
    do_cron = not (running_only or scheduled_only)

    if not pid_files and not schedules and not crons:
        print("No running instances, no scheduled jobs, no cron jobs.")
        return

    if not _confirm_stop_plan(
        pid_files if do_running else [],
        schedules if do_scheduled else [],
        crons if do_cron else [],
        auto_yes,
    ):
        print("Aborted.")
        return

    if do_running and pid_files:
        print(f"Stopping {len(pid_files)} instance(s)...")
        for pf in pid_files:
            _stop_pid_file(pf)
        print("All running instances stopped.")

    if do_scheduled and schedules:
        for j in schedules:
            store.remove_schedule(j["id"])
        print(f"Removed {len(schedules)} scheduled job(s).")

    if do_cron and crons:
        for j in crons:
            store.remove(j["id"])
        print(f"Removed {len(crons)} cron job(s).")


def _print_scheduled_cron_status() -> None:
    """Print the Scheduled + Cron sections shared by all status views."""
    store = JobStore()
    data = store.read()
    schedules = data.get("schedules", [])
    crons = data.get("crons", [])
    if schedules:
        print(f"{len(schedules)} scheduled job(s):")
        for j in schedules:
            print(
                f"  [{j.get('id')}] {j.get('folder')} "
                f"model={j.get('model')} at={j.get('at_iso')}"
            )
    else:
        print("0 scheduled job(s).")
    if crons:
        print(f"{len(crons)} cron job(s):")
        for j in crons:
            last = j.get("last_run_iso") or "never"
            print(
                f"  [{j.get('id')}] {j.get('folder')} "
                f"model={j.get('model')} expr={j.get('expr')!r} "
                f"next={j.get('next_run_iso')} last={last}"
            )
    else:
        print("0 cron job(s).")


def cmd_status(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)

    if folder_arg:
        # Show status for a specific folder
        target = resolve_target_folder(folder_arg)
        init_runtime_files(target)
        pid = read_pid()
        if pid:
            print(f"[{target.name}] Running (PID {pid})")
        else:
            print(f"[{target.name}] Not running.")
            if PID_FILE.exists():  # pragma: no cover
                print("  (stale PID file detected — previous crash?)")
        print(f"  Log: {LOG_FILE}")
        print(f"  Failures: {FAILURES_FILE}")
        _show_failures_summary()
        # Also show any schedule/cron jobs targeting this folder.
        store = JobStore()
        data = store.read()
        slug = target.name
        matching_sched = [
            j for j in data.get("schedules", [])
            if Path(j.get("folder", "")).name == slug
        ]
        matching_cron = [
            j for j in data.get("crons", [])
            if Path(j.get("folder", "")).name == slug
        ]
        if matching_sched:
            print(f"  Scheduled: {len(matching_sched)} job(s)")
            for j in matching_sched:
                print(f"    [{j.get('id')}] at={j.get('at_iso')}")
        if matching_cron:
            print(f"  Cron: {len(matching_cron)} job(s)")
            for j in matching_cron:
                print(
                    f"    [{j.get('id')}] expr={j.get('expr')!r} "
                    f"next={j.get('next_run_iso')}"
                )
    else:
        pid_files = sorted(SCRIPT_DIR.glob(".prompt_executor_*.pid"))
        if not pid_files:
            print("No running instances.")
        else:
            print(f"{len(pid_files)} instance(s):")
            for pf in pid_files:
                slug = pf.stem.replace(".prompt_executor_", "")
                pid = _read_pid_from_file(pf)
                if pid:
                    print(f"  [{slug}] Running (PID {pid})")
                else:
                    print(f"  [{slug}] Stale PID file (cleaned)")
                    try:
                        pf.unlink()
                    except FileNotFoundError:  # pragma: no cover
                        pass
        print()
        _print_scheduled_cron_status()
        return

    # Dead code — resolve_target_folder already validated at line 1560.
    target = Path(folder_arg)  # pragma: no cover
    if not target.is_absolute():  # pragma: no cover
        target = (PROJECT_ROOT / target).resolve()  # pragma: no cover

    if not target.exists():  # pragma: no cover
        done_path = target.parent / (target.name + "_done")  # pragma: no cover
        if done_path.exists():  # pragma: no cover
            print(
                f"\nTarget folder already completed: {done_path.name}"
            )  # pragma: no cover
            return  # pragma: no cover
        print(f"\nFolder not found: {target}")  # pragma: no cover
        return  # pragma: no cover

    if not target.is_dir():  # pragma: no cover
        print(f"\nNot a directory: {target}")  # pragma: no cover
        return  # pragma: no cover

    pending = collect_pending_items(target)  # pragma: no cover
    done_count, pending_count = _count_files_recursive(target)  # pragma: no cover
    total = done_count + pending_count  # pragma: no cover

    print(f"\nTarget: {target}")  # pragma: no cover
    print(
        f"  Prompts: {done_count}/{total} executed ({pending_count} pending)"
    )  # pragma: no cover

    if pending:
        print(f"\n  Next up:")
        for i, p in enumerate(pending[:5], 1):
            try:
                rel = p.relative_to(PROJECT_ROOT)
            except ValueError:
                rel = p
            print(f"    {i}. {rel}")
        if len(pending) > 5:
            print(f"    ... and {len(pending) - 5} more")

    _show_failures_summary()


def _count_files_recursive(directory: Path) -> tuple[int, int]:
    """Count (done, pending) .md files recursively."""
    done = 0
    pending = 0
    for entry in directory.iterdir():
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            if is_done(entry.name):
                # All files in a _done folder count as done
                d, p = _count_all_md(entry)
                done += d + p  # everything in _done folder is done
            else:
                d, p = _count_files_recursive(entry)
                done += d
                pending += p
        elif entry.is_file() and entry.suffix == ".md":
            if is_done(entry.stem):
                done += 1
            else:
                pending += 1
    return done, pending


def _count_all_md(directory: Path) -> tuple[int, int]:
    """Count all .md files in a directory (for _done folders)."""
    count = 0
    for entry in directory.rglob("*.md"):
        if entry.is_file():
            count += 1
    return count, 0


def _show_failures_summary() -> None:
    """Show failures file summary if it exists."""
    if FAILURES_FILE.exists():
        try:
            failures_text = FAILURES_FILE.read_text()
            failure_count = failures_text.count("SKIPPED:")
            if failure_count > 0:
                print(f"\n  Failed: {failure_count} prompt(s) skipped after retries")
                print(f"  Details: {FAILURES_FILE}")
        except OSError:
            pass


# ── Schedule / Cron / Doctor Commands ───────────────────────────────────────


def _build_job_from_args(args: argparse.Namespace) -> dict:
    """Common job-field extraction shared by schedule + cron add paths."""
    target = resolve_target_folder(args.folder)
    # Validate backend early so typos are caught at add-time, not fire-time.
    _ = detect_backend(args.model)
    working_dir_arg = getattr(args, "working_dir", None)
    return {
        "folder": str(target),
        "model": args.model,
        "agent": getattr(args, "agent", None),
        "period": int(getattr(args, "period", WAIT_MINUTES)),
        "max_retries": int(getattr(args, "max_retries", MAX_RETRIES)),
        "retry_wait": int(getattr(args, "retry_wait", RETRY_WAIT_MINUTES)),
        "working_dir": str(working_dir_arg) if working_dir_arg else None,
        "created_at_iso": datetime.now().isoformat(),
    }


def cmd_schedule_add(args: argparse.Namespace) -> None:
    at_str = getattr(args, "at", None)
    in_str = getattr(args, "in_", None)
    if not (at_str or in_str):
        print("ERROR: supply exactly one of --at \"YYYY-MM-DD HH:MM\" or --in <duration>.")
        return
    if at_str and in_str:
        print("ERROR: --at and --in are mutually exclusive.")
        return

    if in_str:
        delta = parse_duration(in_str)
        at_dt = datetime.now() + delta
    else:
        # Accept either ISO ("2026-04-17T09:00") or "YYYY-MM-DD HH:MM".
        try:
            at_dt = datetime.fromisoformat(at_str)
        except ValueError:
            try:
                at_dt = datetime.strptime(at_str, "%Y-%m-%d %H:%M")
            except ValueError:
                try:
                    at_dt = datetime.strptime(at_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    print(f"ERROR: cannot parse --at value: {at_str!r}")
                    return
    if at_dt <= datetime.now():
        print(f"ERROR: --at must be in the future; got {at_dt.isoformat()}")
        return

    job = _build_job_from_args(args)
    job["id"] = _make_job_id("sch")
    job["at_iso"] = at_dt.isoformat()
    store = JobStore()
    store.add_schedule(job)
    print(f"Scheduled job {job['id']} for {at_dt.isoformat()}")
    print(f"  folder={job['folder']} model={job['model']}")
    _start_scheduler_daemon_if_needed()
    print("  scheduler-daemon is running.")


def cmd_schedule_list(_args: argparse.Namespace) -> None:
    store = JobStore()
    data = store.read()
    schedules = data.get("schedules", [])
    if not schedules:
        print("No scheduled jobs.")
        return
    print(f"{len(schedules)} scheduled job(s):")
    for j in schedules:
        print(
            f"  [{j.get('id')}] {j.get('folder')} "
            f"model={j.get('model')} at={j.get('at_iso')}"
        )


def cmd_schedule_remove(args: argparse.Namespace) -> None:
    job_id = args.job_id
    store = JobStore()
    if store.remove(job_id):
        print(f"Removed job {job_id}.")
    else:
        print(f"Job {job_id} not found.")


def cmd_cron_add(args: argparse.Namespace) -> None:
    expr = args.expr
    try:
        parse_cron_expr(expr)  # validation only
    except ValueError as e:
        print(f"ERROR: invalid cron expression: {e}")
        return
    job = _build_job_from_args(args)
    job["id"] = _make_job_id("cron")
    job["expr"] = expr
    now = datetime.now()
    job["last_run_iso"] = None
    job["next_run_iso"] = next_fire_after(expr, now).isoformat()
    store = JobStore()
    store.add_cron(job)
    print(f"Cron job {job['id']} registered.")
    print(f"  folder={job['folder']} model={job['model']} expr={expr!r}")
    print(f"  next fire: {job['next_run_iso']}")
    _start_scheduler_daemon_if_needed()
    print("  scheduler-daemon is running.")


def cmd_cron_list(_args: argparse.Namespace) -> None:
    store = JobStore()
    data = store.read()
    crons = data.get("crons", [])
    if not crons:
        print("No cron jobs.")
        return
    print(f"{len(crons)} cron job(s):")
    for j in crons:
        last = j.get("last_run_iso") or "never"
        print(
            f"  [{j.get('id')}] {j.get('folder')} "
            f"model={j.get('model')} expr={j.get('expr')!r} "
            f"next={j.get('next_run_iso')} last={last}"
        )


def cmd_cron_remove(args: argparse.Namespace) -> None:
    job_id = args.job_id
    store = JobStore()
    if store.remove(job_id):
        print(f"Removed cron job {job_id}.")
    else:
        print(f"Cron job {job_id} not found.")


def cmd_scheduler_daemon(args: argparse.Namespace) -> None:
    """Entry point for the scheduler daemon itself."""
    # Per-instance runtime files already hold None at this point; set our
    # own slug so log() / remove_pid() paths work when we borrow them.
    global PID_FILE, LOG_FILE, FAILURES_FILE
    PID_FILE = SCHEDULER_PID_FILE
    LOG_FILE = SCHEDULER_LOG_FILE
    FAILURES_FILE = SCRIPT_DIR / f".prompt_executor_{SCHEDULER_SLUG}_failures.log"

    if _scheduler_is_running():
        print("scheduler-daemon already running.")
        return

    foreground = bool(getattr(args, "foreground", False))
    if not foreground:
        daemonize()
    install_crash_handlers()
    setup_signals()
    # Clean any stale PID file first.
    if SCHEDULER_PID_FILE.exists():
        try:
            SCHEDULER_PID_FILE.unlink()
        except OSError:
            pass
    write_pid(os.getpid())
    try:
        _scheduler_main_loop()
    finally:
        remove_pid()


def cmd_doctor(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)
    target: Path | None = None
    if folder_arg:
        try:
            target = resolve_target_folder(folder_arg)
        except SystemExit:
            return
    out = run_doctor(target)
    if out is None:
        print("No failure logs found. Nothing to analyze.")
        return
    print(f"Fix plan written to: {out}")
    try:
        print()
        print(out.read_text(encoding="utf-8"))
    except OSError:
        pass


# ── CLI ─────────────────────────────────────────────────────────────────────


def add_common_args(parser: argparse.ArgumentParser) -> None:
    """Add shared arguments to start/run subcommands."""
    parser.add_argument(
        "folder",
        help="Target folder to execute (relative to project root or absolute path)",
    )
    parser.add_argument(
        "-m",
        "--model",
        required=True,
        help="Model to use (REQUIRED). Anthropic models (opus, sonnet, haiku, claude-*) use Claude Code; "
        "all others (e.g., glm-5.1, flash) use OpenCode",
    )
    parser.add_argument(
        "-a",
        "--agent",
        default=None,
        help="OpenCode agent to use (from .opencode/agent/*.md). Ignored for Claude backend.",
    )
    parser.add_argument(
        "-p",
        "--period",
        type=int,
        default=WAIT_MINUTES,
        help=f"Wait time in minutes between prompts (default: {WAIT_MINUTES})",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=MAX_RETRIES,
        help=f"Max retry attempts per prompt before skipping (default: {MAX_RETRIES})",
    )
    parser.add_argument(
        "--retry-wait",
        type=int,
        default=RETRY_WAIT_MINUTES,
        help=f"Base wait in minutes between retries, doubles each retry (default: {RETRY_WAIT_MINUTES})",
    )
    parser.add_argument(
        "--working-dir",
        type=Path,
        default=None,
        help="Directory to run subprocess commands from. Default: project root.",
    )


def _add_schedule_cron_common_args(parser: argparse.ArgumentParser) -> None:
    """Subset of add_common_args that schedule/cron add need (no positional folder)."""
    parser.add_argument(
        "folder",
        help="Target folder to execute (relative to project root or absolute path)",
    )
    parser.add_argument(
        "-m",
        "--model",
        required=True,
        help="Model to use (REQUIRED). Same semantics as run/start.",
    )
    parser.add_argument("-a", "--agent", default=None)
    parser.add_argument("-p", "--period", type=int, default=WAIT_MINUTES)
    parser.add_argument("--max-retries", type=int, default=MAX_RETRIES)
    parser.add_argument("--retry-wait", type=int, default=RETRY_WAIT_MINUTES)
    parser.add_argument("--working-dir", type=Path, default=None)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prompt Executor — sequential prompt runner using Claude Code CLI or OpenCode CLI"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    start_p = sub.add_parser("start", help="Start as background daemon")
    add_common_args(start_p)
    start_p.set_defaults(func=cmd_start)

    run_p = sub.add_parser("run", help="Run in foreground (no daemon)")
    add_common_args(run_p)
    run_p.set_defaults(func=cmd_run)

    stop_p = sub.add_parser(
        "stop",
        help="Stop running daemons and/or remove scheduled/cron jobs. "
        "Prompts for confirmation unless --yes is supplied.",
    )
    stop_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: stop only the instance running this folder (default: stop all)",
    )
    stop_p.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt (safe for scripts).",
    )
    stop_group = stop_p.add_mutually_exclusive_group()
    stop_group.add_argument(
        "--running-only",
        action="store_true",
        help="Only kill running daemons; leave scheduled and cron jobs intact.",
    )
    stop_group.add_argument(
        "--scheduled-only",
        action="store_true",
        help="Only remove one-shot scheduled jobs.",
    )
    stop_group.add_argument(
        "--cron-only",
        action="store_true",
        help="Only remove recurring cron jobs.",
    )
    stop_p.set_defaults(func=cmd_stop)

    status_p = sub.add_parser(
        "status",
        help="Check status — running daemons, scheduled jobs, cron jobs.",
    )
    status_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: target folder to show progress for",
    )
    status_p.set_defaults(func=cmd_status)

    # ── schedule ──
    schedule_p = sub.add_parser(
        "schedule",
        help="Schedule a one-shot run at a future time (--at) or relative offset (--in).",
    )
    schedule_sub = schedule_p.add_subparsers(dest="schedule_cmd", required=True)

    schedule_add_p = schedule_sub.add_parser(
        "add", help="Register a new one-shot scheduled run."
    )
    _add_schedule_cron_common_args(schedule_add_p)
    when_group = schedule_add_p.add_mutually_exclusive_group(required=True)
    when_group.add_argument(
        "--at",
        dest="at",
        default=None,
        help="Absolute time, e.g. \"2026-04-17 09:00\" or \"2026-04-17T09:00:00\".",
    )
    when_group.add_argument(
        "--in",
        dest="in_",
        default=None,
        help="Relative offset, e.g. \"2h30m\", \"45m\", \"90s\".",
    )
    schedule_add_p.set_defaults(func=cmd_schedule_add)

    schedule_list_p = schedule_sub.add_parser("list", help="List scheduled jobs.")
    schedule_list_p.set_defaults(func=cmd_schedule_list)

    schedule_remove_p = schedule_sub.add_parser(
        "remove", help="Remove a scheduled job by ID."
    )
    schedule_remove_p.add_argument("job_id")
    schedule_remove_p.set_defaults(func=cmd_schedule_remove)

    # Bare `schedule <folder> --at ...` without `add` — friendly shortcut.
    # We defer to the add subparser if the first arg after `schedule` is
    # not one of {add, list, remove}.
    #
    # Implemented by inspecting sys.argv before parse_args().
    # (argparse can't express "optional subcommand" cleanly.)

    # ── cron ──
    cron_p = sub.add_parser(
        "cron",
        help="Register a recurring cron-driven run (standard 5-field expression).",
    )
    cron_sub = cron_p.add_subparsers(dest="cron_cmd", required=True)

    cron_add_p = cron_sub.add_parser("add", help="Register a new cron job.")
    _add_schedule_cron_common_args(cron_add_p)
    cron_add_p.add_argument(
        "--expr",
        required=True,
        help="5-field cron expression: \"minute hour dom month dow\".",
    )
    cron_add_p.set_defaults(func=cmd_cron_add)

    cron_list_p = cron_sub.add_parser("list", help="List cron jobs.")
    cron_list_p.set_defaults(func=cmd_cron_list)

    cron_remove_p = cron_sub.add_parser("remove", help="Remove a cron job by ID.")
    cron_remove_p.add_argument("job_id")
    cron_remove_p.set_defaults(func=cmd_cron_remove)

    # ── scheduler-daemon ──
    sd_p = sub.add_parser(
        "scheduler-daemon",
        help="Internal: run the scheduler daemon. Auto-spawned by schedule/cron add.",
    )
    sd_p.add_argument(
        "--foreground",
        action="store_true",
        help="Run in the foreground (for debugging). Default: daemonize.",
    )
    sd_p.set_defaults(func=cmd_scheduler_daemon)

    # ── doctor ──
    doctor_p = sub.add_parser(
        "doctor",
        help="Analyze failure logs and write a fix-plan markdown. Advisory only.",
    )
    doctor_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: target folder. Default: every failures log in prompt-executor/.",
    )
    doctor_p.set_defaults(func=cmd_doctor)

    # Rewrite argv so `schedule <folder> --at ...` implicitly means
    # `schedule add <folder> --at ...`. Same treatment for `cron`.
    _argv = sys.argv[1:]
    if len(_argv) >= 2 and _argv[0] in ("schedule", "cron"):
        verbs = {"add", "list", "remove"}
        if _argv[1] not in verbs and not _argv[1].startswith("-"):
            sys.argv = [sys.argv[0], _argv[0], "add"] + _argv[1:]

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":  # pragma: no cover
    main()
