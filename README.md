# Thunder Code POC - AI-Powered Test Automation

A proof-of-concept implementation of an AI-powered test automation tool that converts user stories into executable test cases, automatically detects UI elements, and runs tests in a browser environment.

## Architecture Overview

This project implements a **clean architecture** with microservices:

- **AI Service** (Python/FastAPI): Handles test case generation from user stories using LLMs and vision analysis
- **Test Executor** (Node.js/TypeScript): Manages browser automation using Playwright and element detection
- **Gateway** (Node.js/TypeScript): Orchestrates the complete workflow

## Features

- ✅ **Natural Language Test Generation**: Convert user stories into executable test cases using AI
- ✅ **Hybrid Element Detection**: Combines DOM analysis and vision AI to find UI elements
- ✅ **Automatic Selector Ranking**: Prioritizes stable selectors (data-testid, IDs, semantic attributes)
- ✅ **Browser Automation**: Full Playwright integration for test execution
- ✅ **Screenshot Capture**: Automatic screenshots at each test step
- ✅ **Clean Architecture**: Separation of concerns with domain, application, and infrastructure layers
- ✅ **Production Ready**: Error handling, retry logic, circuit breakers, rate limiting
- ✅ **Data Persistence**: PostgreSQL database for test cases and execution results
- ✅ **Structured Logging**: Request tracking, metrics collection, detailed health checks
- ✅ **Input Validation**: Comprehensive validation and sanitization

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)
- OpenAI API key or Anthropic API key
- PostgreSQL 15+ (included in Docker Compose)

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd whynot
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI or Anthropic API key
   # Configure database credentials and other settings
   ```

3. **Start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Test the API:**
   ```bash
   curl -X POST http://localhost:3000/api/run-test \
     -H "Content-Type: application/json" \
     -d '{
       "website_url": "https://example.com",
       "user_story": "As a user, I want to navigate to the website and see the homepage"
     }'
   ```

### Local Development

#### AI Service (Python)

```bash
cd services/ai-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload --port 8000
```

#### Test Executor (Node.js)

```bash
cd services/test-executor
npm install
cp .env.example .env
npm run build
npm start
# Or for development: npm run dev
```

#### Gateway (Node.js)

```bash
cd gateway
npm install
cp .env.example .env
npm run build
npm start
# Or for development: npm run dev
```

## API Endpoints

### Gateway Service (Port 3000)

#### `POST /api/run-test`
Complete workflow: Generate tests from user story and execute them.

**Request:**
```json
{
  "website_url": "https://example.com",
  "user_story": "As a user, I want to login to the website",
  "headless": true
}
```

**Response:**
```json
{
  "success": true,
  "test_case": {
    "id": "test-abc123",
    "name": "User can login",
    "steps": [...]
  },
  "execution_result": {
    "execution_id": "exec-xyz789",
    "status": "completed",
    "steps": [...],
    "screenshots": [...]
  },
  "summary": {
    "test_name": "User can login",
    "total_steps": 5,
    "passed_steps": 5,
    "failed_steps": 0,
    "status": "completed",
    "duration_ms": 12345
  }
}
```

#### `POST /api/generate-tests`
Generate test cases only (without execution).

**Request:**
```json
{
  "website_url": "https://example.com",
  "user_story": "As a user, I want to search for products"
}
```

### AI Service (Port 8000)

- `POST /api/generate-tests` - Generate test cases from user story
- `POST /api/analyze-screenshot` - Analyze screenshot for element detection
- `GET /health` - Health check

### Test Executor Service (Port 3001)

- `POST /api/execute-test` - Execute a test case
- `POST /api/detect-elements` - Detect elements from HTML
- `GET /api/results/:id` - Get execution results
- `GET /health` - Health check

## Project Structure

```
whynot/
├── services/
│   ├── ai-service/          # Python FastAPI service
│   │   ├── app/
│   │   │   ├── domain/      # Business models
│   │   │   ├── application/ # Use cases (test generation)
│   │   │   ├── infrastructure/ # LLM, Vision APIs
│   │   │   └── api/         # FastAPI routes
│   │   └── requirements.txt
│   │
│   └── test-executor/       # Node.js service
│       ├── src/
│       │   ├── domain/      # TypeScript models
│       │   ├── application/ # Test runner, step executor
│       │   ├── infrastructure/ # Playwright, selectors
│       │   └── api/         # Express routes
│       └── package.json
│
├── gateway/                 # API Gateway
│   └── src/
│       ├── api/            # Main API endpoint
│       └── workflow/        # Workflow orchestrator
│
├── shared/                  # Shared types
│   └── types/
│
└── docker-compose.yml
```

## How It Works

### 1. Test Generation Flow

```
User Story Input
    ↓
[NLP Engine] → LLM processes user story
    ↓
[Test Case Generator] → Creates test scenarios
    ↓
[Step Decomposer] → Breaks into atomic steps
    ↓
Test Steps with Element Descriptions
```

### 2. Element Detection Flow

```
Test Step with Element Description
    ↓
[DOM Analyzer] → Extracts selectors from HTML
    ↓
[Vision Analyzer] → Analyzes screenshot (optional)
    ↓
[Hybrid Selector] → Combines and ranks selectors
    ↓
Ranked Selector List (data-testid > id > text > visual)
```

### 3. Test Execution Flow

```
Test Case
    ↓
[Test Runner] → Initializes browser
    ↓
For each step:
    [Step Executor] → Locates element
    [Action Performer] → Executes action
    [Screenshot Capture] → Captures state
    ↓
Execution Result with Screenshots
```

## Element Detection Strategy

The system uses a **hybrid approach** with the following priority:

1. **Data attributes** (`data-testid`, `data-cy`) - Stability: 0.95
2. **Stable IDs** - Stability: 0.85
3. **Semantic attributes** (`aria-label`, `role`) - Stability: 0.75
4. **Text content** - Stability: 0.60
5. **Visual position** (from screenshot) - Stability: 0.40
6. **XPath** (last resort) - Stability: 0.30

## Configuration

### Environment Variables

**AI Service:**
- `LLM_PROVIDER`: `openai` or `anthropic`
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: Model to use (default: `gpt-4`)
- `ANTHROPIC_API_KEY`: Your Anthropic API key

**Test Executor:**
- `AI_SERVICE_URL`: URL of AI service (default: `http://localhost:8000`)
- `SCREENSHOTS_DIR`: Directory for screenshots

**Gateway:**
- `AI_SERVICE_URL`: URL of AI service
- `TEST_EXECUTOR_URL`: URL of test executor

## Production Features

This project now includes production-ready features:

- ✅ **Error Handling & Resilience**: Retry logic with exponential backoff, circuit breakers
- ✅ **Data Persistence**: PostgreSQL database for test cases, executions, and step results
- ✅ **Structured Logging**: Request ID tracking, log levels, metrics collection
- ✅ **Input Validation**: Zod-based validation with sanitization
- ✅ **Rate Limiting**: Per-IP rate limiting for API protection
- ✅ **Enhanced Health Checks**: Detailed service status with dependency health
- ✅ **Metrics Collection**: Execution times, success rates, error tracking
- ✅ **Comprehensive Documentation**: API docs, deployment guide, troubleshooting

## Limitations

- Single test case execution (first generated test case)
- Limited assertion types
- No parallel test execution
- No self-healing mechanism (yet)

## Future Enhancements

- [ ] Self-healing tests that adapt to UI changes
- [ ] Test result storage (database)
- [ ] Web dashboard UI
- [ ] CI/CD integration
- [ ] Multi-browser support
- [ ] Parallel test execution
- [ ] Advanced assertion types
- [ ] Test reporting and analytics

## Documentation

- **[API Documentation](./docs/API.md)**: Complete API reference
- **[Deployment Guide](./docs/DEPLOYMENT.md)**: Production deployment instructions
- **[Troubleshooting Guide](./docs/TROUBLESHOOTING.md)**: Common issues and solutions

## Troubleshooting

See the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) for detailed solutions to common issues.

Quick fixes:

- **Services not starting**: Check Docker logs: `docker compose logs [service-name]`
- **Database connection issues**: Verify DATABASE_URL in `.env` matches docker-compose.yml
- **Test execution fails**: Check browser installation and website accessibility
- **Rate limiting**: Adjust limits in `.env` or wait for reset window

## Contributing

This project has been enhanced with production-ready features. Future enhancements:

- Self-healing tests that adapt to UI changes
- Parallel test execution
- Advanced assertion types
- Test reporting and analytics
- CI/CD integration improvements
- Multi-browser support

## License

MIT

