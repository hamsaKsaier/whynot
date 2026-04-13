# Prompt Executor

Sequential prompt runner that executes `.md` prompt files through Claude Code CLI or OpenCode CLI, with retry logic, PID management, and daemon mode.

## Usage

```bash
python3 prompt_executor.py <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `start` | Start as background daemon |
| `run` | Run in foreground (no daemon) |
| `stop` | Stop instance(s) — specific folder or all |
| `status` | Check status and progress |

### Examples

```bash
# Run prompts in foreground with Claude Opus
python3 prompt_executor.py run -m opus prompts/my-prompt/

# Start as daemon with OpenCode GLM
python3 prompt_executor.py start -m glm-5.1 prompts/my-prompt/

# Check status
python3 prompt_executor.py status prompts/my-prompt/

# Stop all running instances
python3 prompt_executor.py stop
```

### Options (start / run)

| Flag | Default | Description |
|------|---------|-------------|
| `-m`, `--model` | *required* | Model to use |
| `-a`, `--agent` | | OpenCode agent (from `.opencode/agent/*.md`). Ignored for Claude backend. |
| `-p`, `--period` | 5 | Wait time in minutes between prompts |
| `--max-retries` | 3 | Max retry attempts per prompt before skipping |
| `--retry-wait` | 10 | Base wait in minutes between retries (doubles each retry) |
| `--working-dir` | project root | Directory to run subprocess commands from |

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

471 tests, 100% coverage enforced via `--cov-fail-under=100`.

Run specific tests:

```bash
pytest tests/test_backend_detection.py -v
pytest tests/ -k "test_detect" -v
```

HTML coverage report:

```bash
pytest --cov=prompt_executor --cov-report=html
```

## File Locations

| File | Purpose |
|------|---------|
| `.prompt_executor_{folder}.pid` | Process ID tracking |
| `.prompt_executor_{folder}.log` | Execution log |
| `.prompt_executor_{folder}_failures.log` | Failed prompt details |
| `.env` | Environment variables (loaded automatically) |
