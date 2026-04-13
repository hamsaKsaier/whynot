from pathlib import Path
from unittest.mock import patch

from prompt_executor import (
    detect_backend,
    _build_claude_cmd,
    _build_opencode_cmd,
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
    MODEL_ALIASES,
)


class TestDetectBackend:
    def test_opus(self):
        assert detect_backend("opus") == BACKEND_CLAUDE

    def test_sonnet(self):
        assert detect_backend("sonnet") == BACKEND_CLAUDE

    def test_haiku(self):
        assert detect_backend("haiku") == BACKEND_CLAUDE

    def test_full_claude_id(self):
        assert detect_backend("claude-opus-4-6") == BACKEND_CLAUDE

    def test_glm51(self):
        assert detect_backend("glm-5.1") == BACKEND_OPENCODE

    def test_glm5(self):
        assert detect_backend("glm-5") == BACKEND_OPENCODE

    def test_glm_turbo(self):
        assert detect_backend("glm-5-turbo") == BACKEND_OPENCODE

    def test_glm47(self):
        assert detect_backend("glm-4.7") == BACKEND_OPENCODE

    def test_glm_flash(self):
        assert detect_backend("glm-4.7-flash") == BACKEND_OPENCODE

    def test_flash_shorthand(self):
        assert detect_backend("flash") == BACKEND_OPENCODE

    def test_glm_shorthand(self):
        assert detect_backend("glm") == BACKEND_OPENCODE

    def test_zai_prefix(self):
        assert detect_backend("zai/glm-5.1") == BACKEND_OPENCODE

    def test_provider_slash(self):
        assert detect_backend("openai/gpt-4") == BACKEND_OPENCODE

    def test_opus_200k(self):
        assert detect_backend("opus-200k") == BACKEND_CLAUDE

    def test_sonnet_200k(self):
        assert detect_backend("sonnet-200k") == BACKEND_CLAUDE

    def test_case_insensitive(self):
        assert detect_backend("OPUS") == BACKEND_CLAUDE

    def test_unknown_defaults_opencode(self):
        assert detect_backend("unknown") == BACKEND_OPENCODE


class TestModelAliases:
    def test_opus(self):
        assert MODEL_ALIASES["opus"] == "claude-opus-4-6[1m]"

    def test_sonnet(self):
        assert MODEL_ALIASES["sonnet"] == "claude-sonnet-4-6[1m]"

    def test_haiku(self):
        assert MODEL_ALIASES["haiku"] == "claude-haiku-4-5-20251001"

    def test_glm51(self):
        assert MODEL_ALIASES["glm-5.1"] == "zai/glm-5.1"

    def test_flash(self):
        assert MODEL_ALIASES["flash"] == "zai/glm-4.7-flash"

    def test_glm(self):
        assert MODEL_ALIASES["glm"] == "zai/glm-5.1"


class TestBuildOpenCodeCmd:
    def test_basic(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", "hello")
        assert "zai/glm-5.1" in cmd
        assert stdin is None

    def test_large_prompt_stdin(self):
        big = "x" * 50000
        cmd, stdin = _build_opencode_cmd("glm-5.1", big)
        assert stdin == big

    def test_agent(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", agent="coder")
        assert "--agent" in cmd

    def test_continue(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", continue_session=True)
        assert "--continue" in cmd

    def test_no_continue_default(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--continue" not in cmd

    def test_skip_permissions(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--dangerously-skip-permissions" in cmd

    def test_skip_permissions_off(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", skip_permissions=False)
        assert "--dangerously-skip-permissions" not in cmd

    def test_prompt_file(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_file_path=Path("/t.md"))
        assert "--file" in cmd
        assert stdin is None

    def test_no_prompt_raises(self):
        import pytest

        with pytest.raises(ValueError):
            _build_opencode_cmd("glm-5.1")

    def test_flash_resolved(self):
        cmd, _ = _build_opencode_cmd("flash", "hi")
        assert "zai/glm-4.7-flash" in cmd


class TestBuildClaudeCmd:
    def test_basic(self):
        cmd = _build_claude_cmd("opus")
        assert "claude" in cmd
        assert "-p" in cmd
        assert "claude-opus-4-6[1m]" in cmd

    def test_has_all_flags(self):
        cmd = _build_claude_cmd("sonnet")
        assert "--permission-mode" in cmd
        assert "--allowedTools" in cmd
        assert "--output-format" in cmd
        assert "--effort" in cmd
