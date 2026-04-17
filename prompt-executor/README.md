# Prompt Executor

Sequential prompt runner that executes `.md` prompt files through Claude Code CLI or OpenCode CLI, with retry logic, PID management, daemon mode, **scheduled + cron executions**, and a **log-analysis `doctor`** command.

## Usage

```bash
python3 prompt_executor.py <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `run` | Run in foreground (no daemon) |
| `start` | Start as background daemon |
| `stop` | Stop running daemon(s), one-shot schedules, and/or cron jobs. Prompts for confirmation unless `--yes`. |
| `status` | Check status — running daemons, scheduled jobs, and cron jobs |
| `schedule <folder> --at TIME \| --in DURATION` | Register a one-shot run at a future time |
| `schedule list` / `schedule remove <id>` | Manage one-shot schedules |
| `cron <folder> --expr "m h dom mon dow"` | Register a recurring cron-driven run |
| `cron list` / `cron remove <id>` | Manage cron jobs |
| `doctor [<folder>]` | Analyze failure logs and emit a markdown fix-plan. Advisory only — never edits prompts or this script. |
| `scheduler-daemon` | Internal — auto-spawned by `schedule`/`cron add` |

### Examples

```bash
# Foreground / daemon (unchanged)
python3 prompt_executor.py run   -m opus prompts/my-prompt/
python3 prompt_executor.py start -m glm-5.1 prompts/my-prompt/

# Schedule a one-shot at an absolute time
python3 prompt_executor.py schedule prompts/my-prompt --at "2026-04-17 09:00" -m opus

# Schedule a one-shot 90 seconds from now (relative)
python3 prompt_executor.py schedule prompts/my-prompt --in 90s -m flash

# List / remove scheduled jobs
python3 prompt_executor.py schedule list
python3 prompt_executor.py schedule remove sch_20260417120000_ab12cd34

# Cron: every weekday at 09:00
python3 prompt_executor.py cron prompts/daily --expr "0 9 * * 1-5" -m sonnet

# Cron: every minute (smoke test)
python3 prompt_executor.py cron prompts/smoke --expr "* * * * *" -m flash

# Stop everything (prompts for confirmation)
python3 prompt_executor.py stop

# Stop without prompt (CI-safe)
python3 prompt_executor.py stop --yes

# Scope stops
python3 prompt_executor.py stop --running-only --yes     # keep schedules/crons alive
python3 prompt_executor.py stop --scheduled-only --yes   # remove one-shots only
python3 prompt_executor.py stop --cron-only --yes        # remove crons only

# Analyze logs and produce a fix plan
python3 prompt_executor.py doctor prompts/my-prompt
```

### Options (run / start / schedule add / cron add)

| Flag | Default | Description |
|------|---------|-------------|
| `-m`, `--model` | *required* | Model to use |
| `-a`, `--agent` | | OpenCode agent (from `.opencode/agent/*.md`). Ignored for Claude backend. |
| `-p`, `--period` | 5 | Wait time in minutes between prompts |
| `--max-retries` | 3 | Max retry attempts per prompt before skipping |
| `--retry-wait` | 10 | Base wait in minutes between retries (doubles each retry) |
| `--working-dir` | project root | Directory to run subprocess commands from |

### Schedule-specific options

| Flag | Description |
|------|-------------|
| `--at "YYYY-MM-DD HH:MM"` | Absolute time (also accepts ISO format). Must be in the future. |
| `--in "<duration>"` | Relative offset: `2h30m`, `45m`, `90s`, `1d`, `1h5m10s`. |

### Cron-specific options

| Flag | Description |
|------|-------------|
| `--expr "m h dom mon dow"` | Standard 5-field cron expression. Supports `*`, `,`, `-`, `/`, ranges (e.g. `1-5`). No named aliases. |

### Stop options

| Flag | Description |
|------|-------------|
| `-y`, `--yes` | Skip the interactive confirmation prompt. |
| `--running-only` | Only kill running daemons; leave schedules/crons alive. |
| `--scheduled-only` | Only remove one-shot schedules. |
| `--cron-only` | Only remove recurring cron jobs. |

The three `--*-only` flags are mutually exclusive and can be combined with `--yes`.

## How Scheduled Executions Work

`schedule <folder> --at TIME -m MODEL` writes a record into `prompt-executor/.prompt_executor_jobs.json` and, if the scheduler daemon is not already running, auto-spawns it. The scheduler daemon wakes every 30 seconds, compares each schedule's `at_iso` to `now`, and when a job is due it spawns `prompt_executor.py run <folder> ...` as a fresh subprocess — reusing every existing retry, logging, and `_done`-tracking code path. The job is then removed from the store so it never fires twice.

Persistence survives reboots: when the scheduler daemon is restarted (by the operator or by a cron entry if you want to belt-and-braces), it replays any overdue jobs.

## How Cron Executions Work

`cron <folder> --expr "0 9 * * 1-5" -m MODEL` registers a recurring job in the same JSON store. The scheduler daemon computes `next_run_iso` using a minimal POSIX-compatible 5-field parser and fires whenever `next_run_iso <= now`. After firing, `last_run_iso` is updated and `next_run_iso` advances to the next match. Cron jobs stay registered until you explicitly remove them.

**Expression syntax:** Standard 5 fields `minute hour day-of-month month day-of-week`. Supports `*`, integers, `N,M,P`, `N-M`, `N-M/S`, `*/S`. Day-of-week uses `0 = Sunday` through `6 = Saturday`. When both `day-of-month` and `day-of-week` are restricted, the match is their union (matches POSIX cron). Named aliases (`@hourly`, `JAN`, `MON`, etc.) are **not** supported — keep it explicit.

## How the `stop` Argument Works

`stop` now reports everything it is about to disable and asks for confirmation:

```text
Found:
  Running   : 2 instance(s)   [blog-system, fire-and-forget]
  Scheduled : 1 one-shot      [sch_20260417_...: prompts/x at 2026-04-17 09:00]
  Cron      : 1 recurring     [cron_20260417_...: prompts/y every "0 * * * *"]
stop 2 running + disable 1 scheduled + disable 1 cron? [y/N]:
```

- Typing `y` / `yes` proceeds; anything else aborts (no changes).
- `--yes` skips the prompt (safe for `run_canary.sh`, CI, cron-wrapping).
- `--running-only` / `--scheduled-only` / `--cron-only` limit the scope.
- `stop <folder>` still works as before (backwards compatible) — it silently kills the matching daemon, and prompts only if that folder also has a scheduled/cron entry.

## How `doctor` Works (Log Analysis / Self-Healing)

`doctor [<folder>]` reads the existing `.prompt_executor_<slug>.log` and `.prompt_executor_<slug>_failures.log` files, classifies every skipped prompt into one of these categories, and writes `.prompt_executor_<slug>_fixplan.md` next to the logs:

| Category | Meaning | Recommendation |
|---|---|---|
| `MCP_ERROR` | MCP server failures, timeouts, auth issues | Run `mcp-manager` / `mcp__context-mode__doctor` |
| `SKILL_ERROR` | Skill not found / validation failure | Re-run `scripts/validate_skills.py` |
| `RATE_LIMIT` | Provider 429 | Bump `--retry-wait` or switch model |
| `QUOTA` | Account quota exhausted | Top up credits; skip for now |
| `AUTH` | 401/403, invalid API key | Check `.env` keys |
| `TIMEOUT` | `TimeoutExpired` or elapsed ≥ `TIMEOUT_SECONDS` | Split the prompt or raise `TIMEOUT_SECONDS` |
| `UNRECOVERABLE` | Autocompact thrash, unknown model, etc. | Fix the prompt / switch model |
| `EXTERNAL` | DNS / 5xx / connection reset | Wait it out — not an executor bug |
| `TRANSIENT` | Default bucket | Already covered by `--max-retries` |

The doctor is **advisory only**. It never edits prompts, never edits `prompt_executor.py`, and never silently changes retry counts. Intended workflow:

1. `stop` to halt execution.
2. `doctor` to produce a fix plan.
3. Read `.prompt_executor_<slug>_fixplan.md`.
4. Apply the recommended change by hand (fix the MCP server, split the prompt, top up credits, etc.).
5. Resume with `run` / `schedule` / `cron`.

This conservative posture keeps the immutable-executor + 100 %-coverage contract intact.

## Backend Selection

| Model String | Backend | CLI Command |
|--------------|---------|-------------|
| `opus` | Claude | `claude -p claude-opus-4-6` |
| `sonnet` | Claude | `claude -p claude-sonnet-4-6` |
| `haiku` | Claude | `claude -p claude-haiku-4-5-20251001` |
| `claude-*` (prefix) | Claude | `claude -p {model}` |
| `glm-5.1` | OpenCode | `opencode run -m zai/glm-5.1` |
| `glm-5` | OpenCode | `opencode run -m zai/glm-5` |
| `glm-5-turbo` | OpenCode | `opencode run -m zai/glm-5-turbo` |
| `glm-4.7` | OpenCode | `opencode run -m zai/glm-4.7` |
| `glm-4.7-flash` | OpenCode | `opencode run -m zai/glm-4.7-flash` |
| `flash` (shorthand) | OpenCode | `opencode run -m zai/glm-4.7-flash` |
| `provider/model` | OpenCode | `opencode run -m {provider}/{model}` |

## Environment Variables

| Variable | Backend | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Claude | API key for Anthropic models |
| `ZAI_API_KEY` | OpenCode | API key for Z.ai GLM models |
| `OPENCODE_CONFIG` | OpenCode | Path to OpenCode config file (optional) |

## Testing

```bash
cd prompt-executor
pip install -r requirements-dev.txt
pytest
```

Run specific tests:

```bash
pytest tests/test_backend_detection.py -v
pytest tests/test_cron_parser.py -v
pytest tests/test_scheduler_daemon.py -v
pytest tests/ -k "doctor" -v
```

HTML coverage report:

```bash
pytest --cov=prompt_executor --cov-report=html
```

## File Locations

| File | Purpose |
|------|---------|
| `.prompt_executor_{folder}.pid` | Process ID for a per-folder daemon |
| `.prompt_executor_{folder}.log` | Execution log (fsync on every write) |
| `.prompt_executor_{folder}_failures.log` | Skipped-prompt details |
| `.prompt_executor_{folder}_fixplan.md` | Generated by `doctor` — advisory fix plan |
| `.prompt_executor_scheduler.pid` | Scheduler daemon PID |
| `.prompt_executor_scheduler.log` | Scheduler daemon log |
| `.prompt_executor_jobs.json` | Shared JSON job store (schedules + crons) |
| `.env` | Environment variables (loaded automatically) |
