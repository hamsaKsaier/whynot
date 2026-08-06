#!/bin/bash
# WhyNot QA — Local Staging Helper
# Runs on offset ports so it can coexist with production docker-compose.
#
# Staging URLs:
#   Frontend:       http://localhost:5283
#   Admin:          http://localhost:5284
#   Gateway API:    http://localhost:3110
#   QA Loop WS:     ws://localhost:3112
#   Database:       localhost:5434

set -e

COMMAND=${1:-up}
ARG2=${2:-}

COMPOSE="docker compose -f docker-compose.staging.yml --env-file .env.staging"

# Run from repo root regardless of where script is called from
cd "$(dirname "$0")/.."

case "$COMMAND" in
  up)
    BRANCH=${ARG2:-}
    if [ -n "$BRANCH" ]; then
      echo "→ Switching to branch: $BRANCH"
      git fetch origin
      git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
      git pull
    fi
    echo "→ Building and starting staging stack..."
    $COMPOSE up -d --build
    echo ""
    echo "✓ Staging ready:"
    echo "    Frontend:   http://localhost:5283"
    echo "    Admin:      http://localhost:5284"
    echo "    Gateway:    http://localhost:3110"
    echo "    Database:   localhost:5434"
    echo ""
    echo "  Check status:  ./scripts/staging.sh ps"
    echo "  Tail logs:     ./scripts/staging.sh logs <service>"
    echo "  Stop:          ./scripts/staging.sh down"
    ;;

  down)
    echo "→ Stopping staging stack..."
    $COMPOSE down
    echo "✓ Staging stopped."
    ;;

  ps)
    $COMPOSE ps
    ;;

  logs)
    SERVICE=${ARG2:-gateway}
    echo "→ Tailing logs for: $SERVICE"
    $COMPOSE logs -f "$SERVICE"
    ;;

  rebuild)
    SERVICE=${ARG2:-frontend}
    echo "→ Rebuilding: $SERVICE"
    $COMPOSE up -d --build "$SERVICE"
    echo "✓ $SERVICE rebuilt."
    ;;

  reset-db)
    echo "WARNING: This will wipe the staging database volume."
    read -p "Continue? (y/N) " confirm
    if [ "$confirm" = "y" ]; then
      $COMPOSE down -v
      $COMPOSE up -d
      echo "✓ Staging database reset."
    else
      echo "Aborted."
    fi
    ;;

  pull)
    BRANCH=${ARG2:-}
    if [ -n "$BRANCH" ]; then
      git fetch origin
      git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
    fi
    git pull
    echo "→ Rebuilding changed services..."
    $COMPOSE up -d --build
    echo "✓ Staging updated."
    ;;

  *)
    echo "WhyNot QA Staging Helper"
    echo ""
    echo "Usage: ./scripts/staging.sh <command> [arg]"
    echo ""
    echo "Commands:"
    echo "  up [branch]        Start staging (optionally switch branch first)"
    echo "  down               Stop staging"
    echo "  ps                 Show service status"
    echo "  logs [service]     Tail a service's logs (default: gateway)"
    echo "  rebuild [service]  Rebuild a single service (default: frontend)"
    echo "  pull [branch]      Pull latest + rebuild"
    echo "  reset-db           Wipe staging database and restart"
    echo ""
    echo "Examples:"
    echo "  ./scripts/staging.sh up feat/friend-ui-byok"
    echo "  ./scripts/staging.sh logs qa-loop-executor"
    echo "  ./scripts/staging.sh rebuild frontend"
    echo "  ./scripts/staging.sh pull feat/friend-ui-byok"
    echo "  ./scripts/staging.sh down"
    ;;
esac
