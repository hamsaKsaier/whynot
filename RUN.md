# How to Run the Application

This guide will help you get Thunder Code up and running quickly.

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
POSTGRES_USER=thundercode
POSTGRES_PASSWORD=thundercode
POSTGRES_DB=thundercode
DATABASE_URL=postgresql://thundercode:thundercode@database:5432/thundercode

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
# Build and start all services
docker compose up --build

# Or run in background (detached mode)
docker compose up --build -d
```

#### Step 3: Verify Services Are Running

Wait about 30-60 seconds for all services to start, then check:

```bash
# Check service status
docker compose ps

# Check health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:8000/health
```

You should see `"status": "healthy"` in the responses.

## Accessing the Application

Once services are running:

### Frontend UI
- **URL**: http://localhost:5173
- Open in your browser to use the web interface

### API Gateway
- **URL**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/ (root endpoint shows available endpoints)

### Test the API

```bash
# Generate and run a test
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to navigate to the website and see the homepage",
    "headless": true
  }'
```

### View Logs

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f gateway
docker compose logs -f test-executor
docker compose logs -f ai-service
docker compose logs -f database
```

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Gateway | 3000 | http://localhost:3000 |
| Test Executor | 3001 | http://localhost:3001 |
| AI Service | 8000 | http://localhost:8000 |
| Frontend | 5173 | http://localhost:5173 |
| Database | 5432 | localhost:5432 |

## Common Commands

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### Restart Services
```bash
docker compose restart
```

### Rebuild Services (after code changes)
```bash
docker compose up --build -d
```

### View Service Status
```bash
docker compose ps
```

### Access Database
```bash
docker compose exec database psql -U thundercode -d thundercode
```

### Clean Everything (including volumes)
```bash
docker compose down -v
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
   docker compose logs
   ```

### Database Connection Errors

1. **Wait for database to be ready:**
   ```bash
   # Check database health
   docker compose exec database pg_isready -U thundercode
   ```

2. **Verify DATABASE_URL in .env matches docker-compose.yml**

### API Key Issues

1. **Verify API key is set:**
   ```bash
   docker compose exec ai-service env | grep OPENAI_API_KEY
   ```

2. **Check API key is valid** - Test with OpenAI directly

### Browser/Playwright Issues

If tests fail with browser errors:

```bash
# Reinstall Playwright dependencies
docker compose exec test-executor npx playwright install-deps chromium
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









