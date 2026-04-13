import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from prompt_executor import (
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
    RESULT_SUCCESS,
    RESULT_TIMEOUT,
    RESULT_ERROR,
    RESULT_FATAL,
    RESULT_SKIP,
    PromptResult,
    execute_prompt,
    execute_prompt_with_retry,
    init_runtime_files,
    PROJECT_ROOT,
)


class TestExecutePrompt:
    def test_success_opencode(self, runtime_files, mock_subprocess_success, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("Do stuff")
        result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_success_claude(self, runtime_files, mock_subprocess_success, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("Do stuff")
        result = execute_prompt(prompt, "opus", BACKEND_CLAUDE)
        assert result.result_code == RESULT_SUCCESS

    def test_empty_prompt(self, runtime_files):
        prompt = runtime_files["log"].parent / "empty.md"
        prompt.write_text("   ")
        result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_permission_error(self, runtime_files):
        prompt = runtime_files["log"].parent / "noperm.md"
        prompt.write_text("hi")
        prompt.chmod(0o000)
        try:
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
            assert result.result_code == RESULT_FATAL
        finally:
            prompt.chmod(0o644)

    def test_os_error_reading(self, runtime_files):
        prompt = runtime_files["log"].parent / "missing.md"
        with patch.object(Path, "read_text", side_effect=OSError("disk error")):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_FATAL

    def test_nonzero_exit(self, runtime_files, mock_subprocess_fail, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_timeout(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch(
            "prompt_executor.subprocess.run",
            side_effect=subprocess.TimeoutExpired("cmd", 3600),
        ):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_TIMEOUT

    def test_binary_not_found(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run", side_effect=FileNotFoundError):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_FATAL

    def test_memory_error(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run", side_effect=MemoryError("oom")):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_FATAL

    def test_keyboard_interrupt_reraise(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run", side_effect=KeyboardInterrupt):
            with pytest.raises(KeyboardInterrupt):
                execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)

    def test_generic_exception(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run", side_effect=RuntimeError("boom")):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_unrecoverable_autocompact(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(
                returncode=1, stdout="Autocompact is thrashing", stderr=""
            )
            result = execute_prompt(prompt, "opus", BACKEND_CLAUDE)
        assert result.result_code == RESULT_SKIP

    def test_unrecoverable_provider_model_not_found(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(
                returncode=1, stdout="", stderr="ProviderModelNotFoundError in response"
            )
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SKIP

    def test_mcp_error_classification(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(
                returncode=1, stdout="", stderr="MCP server 'stripe' failed"
            )
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_skill_error_classification(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(
                returncode=1, stdout="", stderr="Skill 'fix' not found"
            )
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_stdout_logged(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(returncode=0, stdout="x" * 4000, stderr="")
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_stderr_logged(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(
                returncode=0, stdout="", stderr="some warning"
            )
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_no_changes_detected(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        before = {"file1.txt"}
        with (
            patch("prompt_executor.subprocess.run") as mock_run,
            patch("prompt_executor.snapshot_git_state", return_value={"file1.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=False),
        ):
            mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")
            result = execute_prompt(
                prompt, "glm-5.1", BACKEND_OPENCODE, snapshot_before=before
            )
        assert result.result_code == RESULT_ERROR

    def test_changes_detected(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        before = set()
        with (
            patch("prompt_executor.subprocess.run") as mock_run,
            patch("prompt_executor.snapshot_git_state", return_value={"new.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=True),
        ):
            mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")
            result = execute_prompt(
                prompt, "glm-5.1", BACKEND_OPENCODE, snapshot_before=before
            )
        assert result.result_code == RESULT_SUCCESS

    def test_openconfig_env_passthrough(self, runtime_files, fake_env, monkeypatch):
        monkeypatch.setenv("OPENCODE_CONFIG", "/custom/config.jsonc")
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(returncode=0, stdout="", stderr="")
            execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        _, kwargs = mock.call_args
        assert kwargs["env"]["OPENCODE_CONFIG"] == "/custom/config.jsonc"

    def test_custom_working_dir(self, runtime_files, fake_env, tmp_path):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(returncode=0, stdout="", stderr="")
            execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE, working_dir=tmp_path)
        _, kwargs = mock.call_args
        assert kwargs["cwd"] == str(tmp_path)


class TestExecutePromptWithRetry:
    def test_success_first_try(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(RESULT_SUCCESS, "", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is True
        assert fatal is False

    def test_fatal_stops(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(RESULT_FATAL, "dead", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is False
        assert fatal is True

    def test_skip_continues(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(RESULT_SKIP, "unrecoverable", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is False
        assert fatal is False

    def test_retries_then_success(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        calls = [
            PromptResult(RESULT_ERROR, "fail", "", True),
            PromptResult(RESULT_SUCCESS, "", "", True),
        ]
        with (
            patch("prompt_executor.execute_prompt", side_effect=calls),
            patch("prompt_executor.safe_sleep"),
        ):
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is True

    def test_exhausted_retries(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with (
            patch("prompt_executor.execute_prompt") as mock,
            patch("prompt_executor.safe_sleep"),
        ):
            mock.return_value = PromptResult(RESULT_ERROR, "fail", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 2, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is False
        assert fatal is False

    def test_exponential_backoff(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with (
            patch("prompt_executor.execute_prompt") as mock_exec,
            patch("prompt_executor.safe_sleep") as mock_sleep,
        ):
            mock_exec.return_value = PromptResult(RESULT_ERROR, "fail", "", True)
            execute_prompt_with_retry(prompt, 3, 10, "glm-5.1", BACKEND_OPENCODE)
        assert mock_sleep.call_count == 2
        assert mock_sleep.call_args_list[0][0][0] == 10
        assert mock_sleep.call_args_list[1][0][0] == 20
