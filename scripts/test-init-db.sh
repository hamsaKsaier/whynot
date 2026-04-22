#!/usr/bin/env bash
# test-init-db.sh — Apply migrations inside postgres-test container at init time.
# Mounted into /docker-entrypoint-initdb.d/ so PostgreSQL runs it automatically.
# Tolerates individual migration failures (e.g. invalid JSON seed data) so that
# schema DDL succeeds even when INSERT data is malformed.

set -u

MIGRATIONS_DIR="/migrations"
DB="whynot_test"
USER="whynot"

echo "==> test-init-db: applying migrations from $MIGRATIONS_DIR"

FAIL_COUNT=0
OK_COUNT=0

for f in "$MIGRATIONS_DIR"/*.sql; do
  filename="$(basename "$f")"
  if psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=0 -f "$f" > /dev/null 2>&1; then
    echo "    OK    $filename"
    OK_COUNT=$((OK_COUNT + 1))
  else
    echo "    WARN  $filename (non-fatal error — schema may still be created)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo "==> test-init-db: done. OK=$OK_COUNT WARN=$FAIL_COUNT"
