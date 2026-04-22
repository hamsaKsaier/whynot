"""Tests for env var validation, config discovery, and stderr classification."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from prompt_executor import (
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
    _check_env_and_warn,
    _classify_stderr,
    _ensure_opencode_config,
    _find_opencode_config,
    _validate_env_vars,
    init_runtime_files,
    log,
)


class TestValidateEnvVars:
    def test_opencode_missing_zai_key(self, monkeypatch):
        monkeypatch.delenv("ZAI_API_KEY", raising=False)
        assert _validate_env_vars(BACKEND_OPENCODE) == ["ZAI_API_KEY"]

    def test_opencode_with_zai_key(self, monkeypatch):
        monkeypatch.setenv("ZAI_API_KEY", "sk-test")
        assert _validate_env_vars(BACKEND_OPENCODE) == []

    def test_claude_missing_anthropic_key(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        assert _validate_env_vars(BACKEND_CLAUDE) == ["ANTHROPIC_API_KEY"]

    def test_claude_with_anthropic_key(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
        assert _validate_env_vars(BACKEND_CLAUDE) == []

    def test_unknown_backend_returns_empty(self):
        assert _validate_env_vars("unknown") == []


class TestFindOpencodeConfig:
    def test_finds_jsonc_in_current_dir(self, tmp_path):
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        config.write_text("{}")
        assert _find_opencode_config(tmp_path) == config

    def test_finds_json_variant(self, tmp_path):
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.json"
        config.write_text("{}")
        assert _find_opencode_config(tmp_path) == config

    def test_walks_upward(self, tmp_path):
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        config.write_text("{}")
        subdir = tmp_path / "sub" / "deeper"
        subdir.mkdir(parents=True)
        assert _find_opencode_config(subdir) == config

    def test_returns_none_when_missing(self, tmp_path):
        assert _find_opencode_config(tmp_path) is None

    def test_stops_at_filesystem_root(self, tmp_path):
        result = _find_opencode_config(Path("/"))
        assert result is None or result.exists()


class TestClassifyStderr:
    def test_mcp_server_failed(self):
        assert _classify_stderr("MCP server 'stripe' failed") == "MCP_ERROR"

    def test_mcp_timeout(self):
        assert _classify_stderr("MCP timeout after 5000ms") == "MCP_ERROR"

    def test_mcp_case_insensitive(self):
        assert _classify_stderr("mcp server 'ctx' failed") == "MCP_ERROR"

    def test_skill_not_found(self):
        assert _classify_stderr("Skill 'fix-issue' not found") == "SKILL_ERROR"

    def test_skill_validation(self):
        assert _classify_stderr("skill validation failed") == "SKILL_ERROR"

    def test_unrelated_error_returns_none(self):
        assert _classify_stderr("Unrelated error: exit 1") is None

    def test_empty_string_returns_none(self):
        assert _classify_stderr("") is None


class TestCheckEnvAndWarn:
    def test_warns_on_missing_key(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        monkeypatch.delenv("ZAI_API_KEY", raising=False)
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _check_env_and_warn(BACKEND_OPENCODE, "glm-5.1")
        content = log_file.read_text()
        assert "WARNING" in content
        assert "ZAI_API_KEY" in content

    def test_no_warn_when_key_present(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        monkeypatch.setenv("ZAI_API_KEY", "sk-test")
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _check_env_and_warn(BACKEND_OPENCODE, "glm-5.1")
        if log_file.exists():
            content = log_file.read_text()
            assert "WARNING" not in content


class TestEnsureOpencodeConfig:
    def test_warns_when_no_config(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _ensure_opencode_config(tmp_path)
        content = log_file.read_text()
        assert "WARNING" in content
        assert "No .opencode/opencode.jsonc found" in content

    def test_logs_config_path_when_found(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        config.write_text("{}")
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _ensure_opencode_config(tmp_path)
        content = log_file.read_text()
        assert "Using OpenCode config:" in content
        assert str(config) in content
