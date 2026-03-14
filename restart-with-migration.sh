#!/bin/bash
# Restart script for Failure Classification and Chatbot Integration
# This script runs the database migration and restarts all services

set -e

echo "=========================================="
echo "WhyNot - Service Restart Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}Error: docker-compose or docker compose not found${NC}"
    exit 1
fi

# Check if services are running
echo -e "${YELLOW}Checking if services are running...${NC}"
if ! $DOCKER_COMPOSE ps | grep -q "Up"; then
    echo -e "${YELLOW}Services are not running. Starting them first...${NC}"
    $DOCKER_COMPOSE up -d
    sleep 5
fi

# Step 1: Run database migration
echo ""
echo -e "${YELLOW}Step 1: Running database migration...${NC}"
echo "Migration: 006_failure_classification_and_chat.sql"

if $DOCKER_COMPOSE exec -T database psql -U ${POSTGRES_USER:-thundercode} -d ${POSTGRES_DB:-thundercode} < services/database/migrations/006_failure_classification_and_chat.sql 2>&1; then
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
else
    echo -e "${RED}✗ Migration failed. Check the error above.${NC}"
    exit 1
fi

# Verify migration
echo ""
echo -e "${YELLOW}Verifying migration...${NC}"
if $DOCKER_COMPOSE exec -T database psql -U ${POSTGRES_USER:-thundercode} -d ${POSTGRES_DB:-thundercode} -c "\d failure_analyses" &> /dev/null; then
    echo -e "${GREEN}✓ Migration verified: failure_analyses table exists${NC}"
else
    echo -e "${RED}✗ Migration verification failed${NC}"
    exit 1
fi

# Step 2: Restart services
echo ""
echo -e "${YELLOW}Step 2: Restarting services...${NC}"

echo "  - Restarting AI Service (new chatbot endpoints)..."
$DOCKER_COMPOSE restart ai-service
sleep 2

echo "  - Restarting Test Executor (new failure classification)..."
$DOCKER_COMPOSE restart test-executor
sleep 2

echo "  - Restarting Gateway (new chatbot proxy routes)..."
$DOCKER_COMPOSE restart gateway
sleep 2

echo "  - Restarting Frontend..."
$DOCKER_COMPOSE restart frontend 2>/dev/null || echo "  (Frontend may not be in Docker, restart manually if needed)"

echo -e "${GREEN}✓ All services restarted${NC}"

# Step 3: Wait for services to be ready
echo ""
echo -e "${YELLOW}Step 3: Waiting for services to be ready...${NC}"
sleep 5

# Step 4: Verify services
echo ""
echo -e "${YELLOW}Step 4: Verifying service health...${NC}"

check_health() {
    local service=$1
    local url=$2
    local name=$3
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name is healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ $name is not responding${NC}"
        return 1
    fi
}

AI_SERVICE_URL=${AI_SERVICE_URL:-http://localhost:8000}
TEST_EXECUTOR_URL=${TEST_EXECUTOR_URL:-http://localhost:3001}
GATEWAY_URL=${GATEWAY_URL:-http://localhost:3010}

check_health "ai-service" "$AI_SERVICE_URL/health" "AI Service"
check_health "test-executor" "$TEST_EXECUTOR_URL/health" "Test Executor"
check_health "gateway" "$GATEWAY_URL/health" "Gateway"

# Step 5: Summary
echo ""
echo "=========================================="
echo -e "${GREEN}Restart Complete!${NC}"
echo "=========================================="
echo ""
echo "New features available:"
echo "  ✓ Failure Classification System"
echo "  ✓ Recovery Strategies"
echo "  ✓ Chatbot Integration"
echo ""
echo "Next steps:"
echo "  1. Open the frontend and test the chatbot"
echo "  2. Run a test to see failure classification in action"
echo "  3. Check logs if you encounter any issues:"
echo "     docker compose logs -f"
echo ""
echo "To view service status:"
echo "  docker compose ps"
echo ""
echo "To view logs:"
echo "  docker compose logs -f [service-name]"
echo ""






