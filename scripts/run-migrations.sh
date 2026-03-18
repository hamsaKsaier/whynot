#!/usr/bin/env bash
# ============================================================================
# run-migrations.sh -- Run all SQL migrations in order against the database.
#
# Usage:
#   ./scripts/run-migrations.sh                       # uses DATABASE_URL env var
#   DATABASE_URL=postgres://... ./scripts/run-migrations.sh
#   railway run ./scripts/run-migrations.sh            # run on Railway
# ============================================================================

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../services/database/migrations" && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set."
  echo "Usage: DATABASE_URL=postgresql://user:pass@host:port/db $0"
  exit 1
fi

# Check for psql
if ! command -v psql &> /dev/null; then
  echo "ERROR: psql is not installed. Install postgresql-client."
  exit 1
fi

echo "==> Running migrations from: $MIGRATIONS_DIR"
echo "==> Database: ${DATABASE_URL%%@*}@***"
echo ""

# Create a tracking table if it doesn't exist
psql "$DATABASE_URL" -q <<'SQL'
CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# Get list of already applied migrations
APPLIED=$(psql "$DATABASE_URL" -t -A -c "SELECT filename FROM _migrations ORDER BY filename;")

MIGRATION_COUNT=0
SKIP_COUNT=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
  filename="$(basename "$migration_file")"

  # Check if already applied
  if echo "$APPLIED" | grep -qx "$filename"; then
    echo "    SKIP  $filename (already applied)"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  echo "    RUN   $filename ..."
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$migration_file"

  # Record migration
  psql "$DATABASE_URL" -q -c "INSERT INTO _migrations (filename) VALUES ('$filename');"

  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
done

echo ""
echo "==> Done. Applied $MIGRATION_COUNT migration(s), skipped $SKIP_COUNT."
