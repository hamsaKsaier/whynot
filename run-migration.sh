#!/bin/bash
# Run database migration for user story folders

set -e

echo "Running migration 004_user_story_folders.sql..."

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Error: docker-compose or docker compose not found"
    exit 1
fi

# Run migration
$DOCKER_COMPOSE exec -T database psql -U ${POSTGRES_USER:-thundercode} -d ${POSTGRES_DB:-thundercode} < services/database/migrations/004_user_story_folders.sql

echo "Migration completed successfully!"






