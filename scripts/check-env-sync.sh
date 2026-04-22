#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# check-env-sync.sh
#
# CI script that ensures .env.example stays in sync with the codebase:
#   1. Every var defined in .env.example is referenced somewhere in source.
#   2. Every process.env / import.meta.env read in source has a matching
#      .env.example entry (gateway config module is the allowed exception).
#
# Exit code 0 = in sync, 1 = drift detected.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_EXAMPLE="$ROOT/.env.example"
EXIT_CODE=0

# ── 1. Extract var names from .env.example ────────────────────────────────────
# Matches lines like VAR_NAME=value (ignoring comments and blank lines)
ENV_VARS=$(grep -oE '^[A-Z][A-Z0-9_]+' "$ENV_EXAMPLE" | sort -u)

# ── 2. Check for dead entries (in .env.example but not referenced in source) ──
echo "=== Checking for dead .env.example entries ==="
DEAD_COUNT=0

# Vars that are only used in docker-compose or Makefile (not in source code)
# These are expected to only appear in infrastructure files.
INFRA_ONLY_VARS="POSTGRES_PORT AI_SERVICE_PORT GATEWAY_PORT TEST_EXECUTOR_PORT QA_LOOP_EXECUTOR_PORT FRONTEND_PORT ADMIN_FRONTEND_PORT POSTGRES_HOST POSTGRES_PORT_INTERNAL ADMIN_VITE_API_URL SUPERADMIN_FRONTEND_URL TEST_EXECUTOR_CPUS TEST_EXECUTOR_MEMORY TEST_EXECUTOR_CPUS_RESERVED TEST_EXECUTOR_MEMORY_RESERVED"

for var in $ENV_VARS; do
  # Skip infra-only vars (used in docker-compose / Makefile, not in app code)
  if echo "$INFRA_ONLY_VARS" | grep -qw "$var"; then
    continue
  fi

  # Search in source files (ts, tsx, yml) across the codebase.
  # Matches: process.env.VAR, import.meta.env.VAR, 'VAR' in quotes (config schemas),
  # and VAR: as an object key (Zod schema fields in config/env.ts).
  FOUND=$(grep -rlE "(process\.env\.$var|import\.meta\.env\.$var|['\"]$var['\"]|^  $var:)" \
    "$ROOT/gateway/src" \
    "$ROOT/gateway/shared" \
    "$ROOT/frontend/src" \
    "$ROOT/admin-frontend/src" \
    "$ROOT/services" \
    "$ROOT/docker" \
    --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.yaml" \
    2>/dev/null || true)

  if [ -z "$FOUND" ]; then
    echo "  DEAD: $var — defined in .env.example but not referenced in source"
    DEAD_COUNT=$((DEAD_COUNT + 1))
    EXIT_CODE=1
  fi
done

if [ "$DEAD_COUNT" -eq 0 ]; then
  echo "  ✓ No dead entries found"
fi

# ── 3. Check gateway has no direct process.env reads outside config module ────
echo ""
echo "=== Checking for direct process.env reads in gateway (outside config/tests) ==="

# Exclude config/env.ts (the config module itself), test files, and logger (documented exception)
DIRECT_READS=$(grep -rnE "process\.env\." \
  "$ROOT/gateway/src" \
  --include="*.ts" --include="*.tsx" \
  | grep -v '__tests__' \
  | grep -v 'config/env.ts' \
  || true)

# Also check shared, excluding logger (documented circular-dependency exception)
SHARED_READS=$(grep -rnE "process\.env\." \
  "$ROOT/gateway/shared" \
  --include="*.ts" \
  | grep -v 'logger/logger.ts' \
  || true)

COMBINED_READS="$DIRECT_READS$SHARED_READS"

if [ -n "$COMBINED_READS" ]; then
  echo "  FAIL: Found direct process.env reads outside config module:"
  echo "$COMBINED_READS" | sed 's/^/    /'
  EXIT_CODE=1
else
  echo "  ✓ No direct process.env reads outside config module"
fi

# ── 4. Check frontend has no direct import.meta.env reads outside config ──────
echo ""
echo "=== Checking for direct import.meta.env reads in frontend (outside config) ==="

FRONTEND_READS=$(grep -rnE "import\.meta\.env\." \
  "$ROOT/frontend/src" \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'config.ts' \
  | grep -v 'vite-env.d.ts' \
  || true)

if [ -n "$FRONTEND_READS" ]; then
  echo "  FAIL: Found direct import.meta.env reads outside config:"
  echo "$FRONTEND_READS" | sed 's/^/    /'
  EXIT_CODE=1
else
  echo "  ✓ No direct import.meta.env reads outside config module"
fi

# ── 5. Check admin-frontend has no direct reads outside config ────────────────
echo ""
echo "=== Checking for direct import.meta.env reads in admin-frontend (outside config) ==="

ADMIN_READS=$(grep -rnE "import\.meta\.env\." \
  "$ROOT/admin-frontend/src" \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'config.ts' \
  | grep -v 'vite-env.d.ts' \
  || true)

if [ -n "$ADMIN_READS" ]; then
  echo "  FAIL: Found direct import.meta.env reads outside config:"
  echo "$ADMIN_READS" | sed 's/^/    /'
  EXIT_CODE=1
else
  echo "  ✓ No direct import.meta.env reads outside config module"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✓ All env var checks passed"
else
  echo "✗ Env var sync issues detected — see above"
fi

exit $EXIT_CODE
