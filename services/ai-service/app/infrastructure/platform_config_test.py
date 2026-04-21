"""Tests for platform_config.get_recon_model / get_recon_models fall-back logic."""

import asyncio
from typing import Optional

import pytest

from app.infrastructure import platform_config


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(autouse=True)
def _reset_cache(monkeypatch):
    """Clear the module-level cache before each test so fixtures compose."""
    platform_config.invalidate_cache()
    yield
    platform_config.invalidate_cache()


def _patch_config(monkeypatch, payload: dict) -> None:
    async def fake_get_platform_config() -> dict:
        return payload

    monkeypatch.setattr(platform_config, "get_platform_config", fake_get_platform_config)


def test_get_recon_model_uses_override_when_set(monkeypatch):
    _patch_config(
        monkeypatch,
        {
            "providers": [],
            "defaultProvider": {"provider": "anthropic", "model": "default-model"},
            "reconModels": {"small": "override-small", "medium": None, "large": ""},
        },
    )

    assert _run(platform_config.get_recon_model("small")) == "override-small"


def test_get_recon_model_falls_back_when_override_null(monkeypatch):
    _patch_config(
        monkeypatch,
        {
            "defaultProvider": {"provider": "anthropic", "model": "default-model"},
            "reconModels": {"small": None, "medium": None, "large": None},
        },
    )

    for tier in ("small", "medium", "large"):
        assert _run(platform_config.get_recon_model(tier)) == "default-model"


def test_get_recon_model_falls_back_when_override_empty_string(monkeypatch):
    _patch_config(
        monkeypatch,
        {
            "defaultProvider": {"provider": "anthropic", "model": "default-model"},
            "reconModels": {"small": "", "medium": "   ", "large": ""},
        },
    )

    # Empty string is treated as "not set" and falls back.
    assert _run(platform_config.get_recon_model("small")) == "default-model"
    # A whitespace-only override is considered set — the admin layer is
    # responsible for normalizing user input before persisting.
    assert _run(platform_config.get_recon_model("medium")) == "   "
    assert _run(platform_config.get_recon_model("large")) == "default-model"


def test_get_recon_model_returns_none_when_no_default(monkeypatch):
    _patch_config(
        monkeypatch,
        {
            "defaultProvider": None,
            "reconModels": {},
        },
    )

    assert _run(platform_config.get_recon_model("medium")) is None


def test_get_recon_model_rejects_unknown_tier(monkeypatch):
    _patch_config(monkeypatch, {"defaultProvider": {"model": "x"}, "reconModels": {}})

    with pytest.raises(ValueError):
        _run(platform_config.get_recon_model("huge"))


def test_get_recon_model_absent_reconmodels_block(monkeypatch):
    _patch_config(
        monkeypatch,
        {
            "defaultProvider": {"provider": "anthropic", "model": "default-model"},
            # Intentionally missing "reconModels" — ai-config endpoint may omit it
            # when the gateway hasn't been updated yet.
        },
    )

    assert _run(platform_config.get_recon_model("large")) == "default-model"


def test_get_recon_models_returns_all_tiers(monkeypatch):
    _patch_config(
        monkeypatch,
        {
            "defaultProvider": {"provider": "anthropic", "model": "default-model"},
            "reconModels": {"small": "s-override", "medium": None, "large": "l-override"},
        },
    )

    result = _run(platform_config.get_recon_models())
    assert result == {
        "small": "s-override",
        "medium": "default-model",
        "large": "l-override",
    }


def test_get_recon_models_handles_fetch_failure(monkeypatch):
    async def raiser() -> dict:
        raise RuntimeError("gateway unreachable")

    monkeypatch.setattr(platform_config, "get_platform_config", raiser)

    result = _run(platform_config.get_recon_models())
    assert result == {"small": None, "medium": None, "large": None}


def test_get_recon_model_handles_fetch_failure(monkeypatch):
    async def raiser() -> dict:
        raise RuntimeError("gateway unreachable")

    monkeypatch.setattr(platform_config, "get_platform_config", raiser)

    value: Optional[str] = _run(platform_config.get_recon_model("small"))
    assert value is None
