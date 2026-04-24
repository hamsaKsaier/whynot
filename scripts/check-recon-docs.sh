#!/usr/bin/env bash
# CI gate for Recon documentation.
#
# Enforces the rules in .claude/rules/recon-safety.md:
#   - Rule #6: banned vocabulary must not appear in user-facing docs.
#   - Rule (this file): every English Recon doc must have a counterpart
#     in ar/fr/de/es with the same filename (5-language parity).
#
# Exits non-zero on any violation.

set -euo pipefail

DOCS_ROOT="${DOCS_ROOT:-$(cd "$(dirname "$0")/.." && pwd)/docs}"
LANGS=(en ar fr de es)
RECON_DIR="recon"

# Whole-word banned terms. Matched case-insensitively against the docs
# tree under each language's /recon/ subdirectory.
BANNED_TERMS=(
  "Shannon"
  "KeygraphHQ"
  "nmap"
  "subfinder"
  "whatweb"
  "schemathesis"
  "Playwright"
  "Anthropic"
  "Claude"
)

fail=0

# --- 1. Banned-vocabulary scan -----------------------------------------------
echo "==> Scanning Recon docs for banned vocabulary"
for lang in "${LANGS[@]}"; do
  dir="$DOCS_ROOT/$lang/$RECON_DIR"
  [[ -d "$dir" ]] || continue
  for term in "${BANNED_TERMS[@]}"; do
    # -w: whole word. -i: case-insensitive. -r: recursive.
    if matches=$(grep -riwn --include='*.md' --include='*.mdx' "$term" "$dir" 2>/dev/null); then
      echo "FAIL: banned term '$term' found in $dir"
      echo "$matches"
      fail=1
    fi
  done
done

# --- 2. Five-language parity --------------------------------------------------
echo "==> Verifying 5-language parity for Recon docs"
en_dir="$DOCS_ROOT/en/$RECON_DIR"
if [[ ! -d "$en_dir" ]]; then
  echo "FAIL: English Recon docs directory missing: $en_dir"
  exit 1
fi

# Collect English filenames (just the basename, not the path).
mapfile -t en_files < <(cd "$en_dir" && find . -type f \( -name '*.md' -o -name '*.mdx' \) | sort)

if [[ ${#en_files[@]} -eq 0 ]]; then
  echo "FAIL: no English Recon docs found in $en_dir"
  exit 1
fi

for lang in ar fr de es; do
  lang_dir="$DOCS_ROOT/$lang/$RECON_DIR"
  if [[ ! -d "$lang_dir" ]]; then
    echo "FAIL: missing $RECON_DIR directory for language '$lang'"
    fail=1
    continue
  fi
  for relpath in "${en_files[@]}"; do
    target="$lang_dir/${relpath#./}"
    if [[ ! -f "$target" ]]; then
      echo "FAIL: $lang missing translation for en/$RECON_DIR/${relpath#./}"
      fail=1
    fi
  done
done

if [[ $fail -ne 0 ]]; then
  echo
  echo "Recon docs CI gate failed. See .claude/rules/recon-safety.md."
  exit 1
fi

echo "OK: Recon docs pass banned-vocab and 5-language parity gates."
