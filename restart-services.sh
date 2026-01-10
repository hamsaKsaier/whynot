#!/bin/bash
# Quick restart script for all services (without migration)

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Error: docker-compose or docker compose not found"
    exit 1
fi

echo -e "${YELLOW}Restarting all services...${NC}"

$DOCKER_COMPOSE restart

echo -e "${GREEN}✓ All services restarted${NC}"
echo ""
echo "Services restarted. Wait a few seconds for them to be ready."






