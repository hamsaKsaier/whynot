#!/bin/sh
# ============================================
# whynot — Migration runner
# ============================================
# Runs every time the compose stack comes up. Tracks applied migrations
# in a schema_migrations table and only runs files that haven't been
# applied yet.
#
# Env:
#   POSTGRES_HOST     (default: database)
#   POSTGRES_PORT     (default: 5432)
#   POSTGRES_USER     (default: whynot)
#   POSTGRES_PASSWORD (required)
#   POSTGRES_DB       (default: whynot)
#   MIGRATIONS_DIR    (default: /migrations)
# ============================================

set -eu

: "${POSTGRES_HOST:=database}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=whynot}"
: "${POSTGRES_DB:=whynot}"
: "${MIGRATIONS_DIR:=/migrations}"

export PGPASSWORD="${POSTGRES_PASSWORD:-whynot}"
PSQL="psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1 -X -q"

echo "[migrate] waiting for $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB..."
i=0
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[migrate] database not ready after 60s, giving up"
    exit 1
  fi
  sleep 1
done
echo "[migrate] database ready"

$PSQL <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

applied=0
skipped=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$f" ] || continue
  v=$(basename "$f" .sql)
  exists=$($PSQL -tAc "SELECT 1 FROM schema_migrations WHERE version = '$v'")
  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "[migrate] applying $v"
  $PSQL -f "$f"
  $PSQL -c "INSERT INTO schema_migrations (version) VALUES ('$v')"
  applied=$((applied + 1))
done

echo "[migrate] done ($applied applied, $skipped already in schema_migrations)"
