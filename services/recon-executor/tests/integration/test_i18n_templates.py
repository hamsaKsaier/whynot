"""Assert the report template exists for all 5 supported locales (en, ar, fr, de, es).

The executor has no user-facing strings of its own (per C1), but it renders
locale-specific Markdown reports from the template files shipped with the
service. This test just checks file presence.
"""

from __future__ import annotations

from pathlib import Path


def test_every_supported_locale_has_a_report_template():
    templates_dir = Path(__file__).resolve().parents[2] / "app" / "templates"
    for locale in ("en", "ar", "fr", "de", "es"):
        path = templates_dir / f"report.{locale}.md"
        assert path.exists(), f"missing template: {path}"
        assert path.read_text(encoding="utf-8").strip(), f"empty template: {path}"
