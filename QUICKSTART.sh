#!/bin/bash

# WhyNot - Quick Start Script

echo "🚀 WhyNot - Quick Start"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Application Environment
NODE_ENV=development
LOG_LEVEL=info

# Database Configuration
POSTGRES_USER=whynot
POSTGRES_PASSWORD=whynot
POSTGRES_DB=whynot
DATABASE_URL=postgresql://whynot:whynot@database:5432/whynot

# Gateway Service
PORT=3000
FRONTEND_URL=http://localhost:5173
AI_SERVICE_URL=http://ai-service:8000
TEST_EXECUTOR_URL=http://test-executor:3001

# AI Service Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_VISION_MODEL=gpt-4-vision-preview

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_TEST_EXECUTION_MAX=10
RATE_LIMIT_TEST_GENERATION_MAX=20
EOF
    echo "⚠️  Created .env file. Please edit it and add your OpenAI API key!"
    echo "   Then run this script again."
    exit 1
fi

# Check if API key is set
if grep -q "your-openai-api-key-here" .env || grep -q "your-api-key-here" .env || grep -q "your_openai_api_key_here" .env; then
    echo "⚠️  Please edit .env and add your actual OpenAI API key!"
    echo "   Current .env file has placeholder values."
    echo "   Replace 'your-openai-api-key-here' with your actual key."
    exit 1
fi

echo "✅ Environment file found"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Start services
echo "🐳 Starting Docker services..."
echo ""

# Use docker compose (newer) or docker-compose (older)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose up --build -d
else
    docker-compose up --build -d
fi

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check services
echo ""
echo "🔍 Checking service health..."

AI_HEALTH=$(curl -s http://localhost:8000/health | grep -o '"status":"healthy"' || echo "")
EXECUTOR_HEALTH=$(curl -s http://localhost:3001/health | grep -o '"status":"healthy"' || echo "")
GATEWAY_HEALTH=$(curl -s http://localhost:3000/health | grep -o '"status":"healthy"' || echo "")

if [ -n "$AI_HEALTH" ] && [ -n "$EXECUTOR_HEALTH" ] && [ -n "$GATEWAY_HEALTH" ]; then
    echo ""
    echo "✅ All services are healthy!"
    echo ""
    echo "📋 Service URLs:"
    echo "   - Frontend:     http://localhost:5173"
    echo "   - Gateway:      http://localhost:3000"
    echo "   - AI Service:   http://localhost:8000"
    echo "   - Test Executor: http://localhost:3001"
    echo ""
    echo "🧪 Try running a test via API:"
    echo ""
    echo 'curl -X POST http://localhost:3000/api/run-test \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -d '"'"'{'
    echo '    "website_url": "https://example.com",'
    echo '    "user_story": "As a user, I want to navigate to the website and see the homepage"'
    echo '  }'"'"
    echo ""
    echo "🌐 Or use the web UI at: http://localhost:5173"
    echo ""
    echo "📖 For more information, see:"
    echo "   - RUN.md - Detailed run instructions"
    echo "   - docs/API.md - API documentation"
    echo "   - docs/TROUBLESHOOTING.md - Troubleshooting guide"
    echo ""
    echo "🛑 To stop services: docker compose down"
else
    echo ""
    echo "⚠️  Some services may not be ready yet. Check logs with:"
    echo "   docker-compose logs"
    echo ""
fi





