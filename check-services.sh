#!/bin/bash

echo "🔍 Checking service health..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check service status
echo "📦 Checking Docker containers..."
docker compose ps

echo ""
echo "🏥 Checking service health endpoints..."

# Check Gateway
echo -n "Gateway (http://localhost:3000): "
GATEWAY_HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    GATEWAY_STATUS=$(echo $GATEWAY_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$GATEWAY_STATUS" = "healthy" ]; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  $GATEWAY_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

# Check Test Executor (CRITICAL for WebSocket)
echo -n "Test Executor (http://localhost:3001): "
EXECUTOR_HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
if [ $? -eq 0 ]; then
    EXECUTOR_STATUS=$(echo $EXECUTOR_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$EXECUTOR_STATUS" = "healthy" ]; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  $EXECUTOR_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ Not accessible - THIS IS LIKELY YOUR PROBLEM!${NC}"
    echo -e "${YELLOW}   The test-executor service must be running on port 3001 for WebSocket connections.${NC}"
fi

# Check AI Service
echo -n "AI Service (http://localhost:8000): "
AI_HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    AI_STATUS=$(echo $AI_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$AI_STATUS" = "healthy" ]; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  $AI_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

echo ""
echo "📋 Recommendations:"
echo ""

# Check if test-executor is the problem
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Test Executor service is not accessible.${NC}"
    echo ""
    echo "Try these steps:"
    echo "  1. Check if the service is running:"
    echo "     docker compose ps test-executor"
    echo ""
    echo "  2. Check the logs for errors:"
    echo "     docker compose logs test-executor"
    echo ""
    echo "  3. Restart the test-executor service:"
    echo "     docker compose restart test-executor"
    echo ""
    echo "  4. If that doesn't work, restart all services:"
    echo "     docker compose restart"
    echo ""
    echo "  5. If still having issues, rebuild and restart:"
    echo "     docker compose up --build -d test-executor"
else
    echo -e "${GREEN}✅ All services appear to be accessible.${NC}"
    echo ""
    echo "If you're still experiencing WebSocket errors:"
    echo "  1. Check test-executor logs for WebSocket errors:"
    echo "     docker compose logs test-executor | grep -i websocket"
    echo ""
    echo "  2. Check browser console for specific error messages"
    echo ""
    echo "  3. Try running a test in headless mode first:"
    echo "     (This bypasses WebSocket and helps isolate the issue)"
fi

echo ""
echo "📖 For more help, see: docs/TROUBLESHOOTING.md"





