#!/usr/bin/env python3
"""
Prompt Executor
Sequentially executes all .md prompts in a target folder using either
Claude Code CLI (claude -p) or OpenCode CLI (opencode run), auto-detected
from the --model argument.

Backend selection:
    Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code CLI
    All other models (glm-*, zai/*, etc.)           → OpenCode CLI

Model alias conventions:
    Claude backend:
        opus, sonnet, haiku          → claude-opus-4-6[1m], etc.
        opus-200k, sonnet-200k       → claude-opus-4-6, etc. (200k context)
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
    python3 prompt-executor/prompt_executor.py stop  [<folder>]
    python3 prompt-executor/prompt_executor.py status [<folder>]

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
"""

import argparse
import atexit
import os
import signal
import subprocess
import sys
import time
import traceback as tb_module
from collections import namedtuple
from datetime import datetime
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
    "opus": "claude-opus-4-6[1m]",
    "sonnet": "claude-sonnet-4-6[1m]",
    "haiku": "claude-haiku-4-5-20251001",
    "opus-200k": "claude-opus-4-6",
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
)


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


def _check_env_and_warn(backend: str, model: str) -> None:
    """Log a warning if env vars are missing. Does not raise."""
    missing = _validate_env_vars(backend)
    if missing:
        resolved = MODEL_ALIASES.get(model.lower(), model)
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


def log(msg: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"
    try:
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
      3. Some argv element to contain the target folder basename (slug).
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

        # 3. Some argv element contains the slug (target folder basename)
        slug_bytes = slug.encode("utf-8")
        if not any(slug_bytes in arg for arg in argv[1:]):
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
                log(f"  WARNING: Exit code 0 but NO filesystem changes detected.")
                log(f"  WARNING: LLM likely produced text output without using tools.")
                err_msg = (
                    "No filesystem changes detected (text-only output, no tool use)"
                )
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
    Execute a prompt with retry logic and exponential backoff.

    Takes a git snapshot before each attempt and verifies file changes
    after each successful execution. If the LLM exits 0 but did not
    modify any files (text-only output), the attempt is treated as a
    retryable failure.

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
            backoff_min = retry_wait_min * (2 ** (attempt - 1))
            safe_sleep(backoff_min, label=f"retry {attempt + 1}")
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


def _stop_pid_file(pid_file: Path) -> bool:
    """Stop the instance tracked by a PID file. Returns True if stopped."""
    pid = _read_pid_from_file(pid_file)
    if not pid:
        # Stale PID file
        try:
            pid_file.unlink()
        except FileNotFoundError:
            pass
        return False

    slug = pid_file.stem.replace(".prompt_executor_", "")
    print(f"  Stopping [{slug}] (PID {pid})...")
    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(10):
            try:
                os.kill(pid, 0)
                time.sleep(0.5)
            except ProcessLookupError:
                break
    except ProcessLookupError:
        pass
    try:
        pid_file.unlink()
    except FileNotFoundError:
        pass
    print(f"  Stopped [{slug}].")
    return True


def cmd_stop(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)

    if folder_arg:
        # Stop a specific instance
        target = resolve_target_folder(folder_arg)
        init_runtime_files(target)
        pid = read_pid()
        if not pid:
            print(f"Not running for [{target.name}].")
            clean_stale_pid()
            return
        _stop_pid_file(PID_FILE)
    else:
        # Stop all running instances
        pid_files = sorted(SCRIPT_DIR.glob(".prompt_executor_*.pid"))
        if not pid_files:
            print("No running instances found.")
            return
        print(f"Stopping {len(pid_files)} instance(s)...")
        for pf in pid_files:
            _stop_pid_file(pf)
        print("All stopped.")


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

    stop_p = sub.add_parser("stop", help="Stop instance(s) — specific folder or all")
    stop_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: stop only the instance running this folder (default: stop all)",
    )
    stop_p.set_defaults(func=cmd_stop)

    status_p = sub.add_parser("status", help="Check status and progress")
    status_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: target folder to show progress for",
    )
    status_p.set_defaults(func=cmd_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":  # pragma: no cover
    main()
