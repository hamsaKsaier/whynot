import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def tmp_project(tmp_path, monkeypatch):
    (tmp_path / "prompts" / "test-folder").mkdir(parents=True)
    (tmp_path / ".opencode").mkdir()
    (tmp_path / ".opencode" / "opencode.jsonc").write_text('{"model":"zai/glm-5.1"}')
    (tmp_path / "prompts" / "test-folder" / "01-task.md").write_text(
        "# Task\nDo a thing."
    )
    (tmp_path / "prompts" / "test-folder" / "02-impl.md").write_text(
        "# Impl\nBuild it."
    )
    (tmp_path / "prompts" / "test-folder" / "03-done_done.md").write_text(
        "# Done\nAlready done."
    )
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture(autouse=True)
def isolate_runtime_files(tmp_path, monkeypatch):
    monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
    yield


@pytest.fixture
def runtime_files(tmp_path, monkeypatch):
    import prompt_executor

    slug = "test-folder"
    log_file = tmp_path / f".prompt_executor_{slug}.log"
    pid_file = tmp_path / f".prompt_executor_{slug}.pid"
    failures_file = tmp_path / f".prompt_executor_{slug}_failures.log"
    monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
    monkeypatch.setattr("prompt_executor.PID_FILE", pid_file)
    monkeypatch.setattr("prompt_executor.FAILURES_FILE", failures_file)
    return {"log": log_file, "pid": pid_file, "failures": failures_file}


@pytest.fixture
def mock_subprocess_success():
    with patch("prompt_executor.subprocess.run") as mock:
        mock.return_value = MagicMock(returncode=0, stdout="ok", stderr="")
        yield mock


@pytest.fixture
def mock_subprocess_fail():
    with patch("prompt_executor.subprocess.run") as mock:
        mock.return_value = MagicMock(returncode=1, stdout="", stderr="Error occurred")
        yield mock


@pytest.fixture
def fake_env(monkeypatch):
    monkeypatch.setenv("ZAI_API_KEY", "sk-zai-test-1234")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-1234")
