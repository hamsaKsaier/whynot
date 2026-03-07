#!/bin/bash
# Rebuild and restart test-executor with latest source changes
set -e

COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "📦 Recompiling TypeScript inside test-executor container..."
docker exec whynot-test-executor-1 sh -c "cd /app && npm run build"

echo "🔄 Restarting test-executor..."
docker compose -f "$COMPOSE_DIR/docker-compose.yml" restart test-executor

echo "✅ Done! test-executor is running with latest changes."
echo "📋 Logs:"
sleep 3
docker compose -f "$COMPOSE_DIR/docker-compose.yml" logs test-executor --tail=8
