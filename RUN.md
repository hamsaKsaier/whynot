# How to Run the Application

This guide will help you get WhyNot up and running quickly.

## Prerequisites

Before starting, ensure you have:

1. **Docker Desktop** installed and running
   - Download from: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version` and `docker compose version`

2. **OpenAI or Anthropic API Key**
   - Get OpenAI key: https://platform.openai.com/api-keys
   - Get Anthropic key: https://console.anthropic.com/

## Quick Start (Recommended)

### Option 1: Using the Quick Start Script

```bash
# Make the script executable (first time only)
chmod +x QUICKSTART.sh

# Run the quick start script
./QUICKSTART.sh
```

The script will:
- Check for Docker
- Create `.env` file if needed
- Start all services
- Verify they're running

### Option 2: Manual Setup

#### Step 1: Create Environment File

Create a `.env` file in the project root:

```bash
# Copy the example (if it exists)
cp .env.example .env

# Or create manually
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
```

**Important:** Replace `your-openai-api-key-here` with your actual API key!

#### Step 2: Start Services

```bash
# Build and start all services (detached)
make start-build

# Or just start without rebuilding
make start
```

#### Step 3: Verify Services Are Running

Wait about 30-60 seconds for all services to start, then check:

```bash
# Check service status
make ps

# Check health endpoints (host ports; see .env for overrides)
curl http://localhost:3010/health   # gateway
curl http://localhost:3011/health   # test-executor
curl http://localhost:8010/health   # ai-service
```

You should see `"status": "healthy"` in the responses.

## Accessing the Application

Once services are running:

### Frontend UI
- **URL**: http://localhost:5183
- Open in your browser to use the web interface

### API Gateway
- **URL**: http://localhost:3010
- **Health Check**: http://localhost:3010/health
- **API Docs**: http://localhost:3010/ (root endpoint shows available endpoints)

### Test the API

```bash
# Generate and run a test
curl -X POST http://localhost:3010/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to navigate to the website and see the homepage",
    "headless": true
  }'
```

### View Logs

```bash
make logs                  # all services
make logs-gateway
make logs-test-executor
make logs-ai
make logs-db
```

## Service Ports

Host ports are configurable through `.env` (see `.env.example`). Defaults:

| Service | Env var | Default host port | Container port |
|---------|---------|------------------:|---------------:|
| Gateway          | `GATEWAY_PORT`           | 3010 | 3000 |
| Test Executor    | `TEST_EXECUTOR_PORT`     | 3011 | 3001 |
| QA Loop Executor | `QA_LOOP_EXECUTOR_PORT`  | 3012 | 3002 |
| AI Service       | `AI_SERVICE_PORT`        | 8010 | 8000 |
| Frontend         | `FRONTEND_PORT`          | 5183 | 80   |
| Admin Frontend   | `ADMIN_FRONTEND_PORT`    | 5184 | 80   |
| Database         | `POSTGRES_PORT`          | 5433 | 5432 |

## Common Commands

```bash
make start           # Start all services
make stop            # Stop services
make down            # Stop and remove containers
make restart         # Restart services
make start-build     # Rebuild images and start
make rebuild         # --no-cache rebuild and start
make ps              # Service status
make psql            # psql shell in the database
make clean           # Remove containers, volumes, local images (destructive)
```

If you need a flag the Makefile doesn't expose, call compose directly:

```bash
docker compose -f docker/compose/docker-compose.yml --env-file .env <command>
```

## Troubleshooting

### Services Won't Start

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Check port availability:**
   ```bash
   # Check if ports are in use
   lsof -i :3000
   lsof -i :3001
   lsof -i :8000
   ```

3. **View error logs:**
   ```bash
   make logs
   ```

### Database Connection Errors

1. **Wait for database to be ready:**
   ```bash
   # Check database health
   docker compose -f docker/compose/docker-compose.yml --env-file .env exec database pg_isready -U whynot
   ```

2. **Verify DATABASE_URL in .env matches docker/compose/docker-compose.yml**

### API Key Issues

1. **Verify API key is set:**
   ```bash
   docker compose -f docker/compose/docker-compose.yml --env-file .env exec ai-service env | grep OPENAI_API_KEY
   ```

2. **Check API key is valid** - Test with OpenAI directly

### Browser/Playwright Issues

If tests fail with browser errors:

```bash
# Reinstall Playwright dependencies
docker compose -f docker/compose/docker-compose.yml --env-file .env exec test-executor npx playwright install-deps chromium
```

## Next Steps

- Read the [API Documentation](./docs/API.md) for detailed endpoint information
- Check [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for common issues
- Review [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for production deployment

## Development Mode

For local development without Docker:

### Gateway
```bash
cd gateway
npm install
npm run dev
```

### Test Executor
```bash
cd services/test-executor
npm install
npm run dev
```

### AI Service
```bash
cd services/ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Note:** You'll need to set up the database separately and update service URLs in `.env`.

























