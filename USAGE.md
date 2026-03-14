# How to Use WhyNot

This guide will walk you through setting up and using the POC system.

## Prerequisites

Before starting, make sure you have:
- **Docker** and **Docker Compose** installed
- An **OpenAI API key** or **Anthropic API key**
- At least 4GB of free disk space

## Step 1: Setup Environment Variables

1. Create a `.env` file in the root directory:

```bash
cd /Users/takiacademy/whynot
cp .env.example .env
```

2. Edit the `.env` file and add your API key:

```bash
# For OpenAI (recommended)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_VISION_MODEL=gpt-4-vision-preview

# OR for Anthropic
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
```

## Step 2: Start the Services

### Option A: Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

This will start:
- **AI Service** on `http://localhost:8000`
- **Test Executor** on `http://localhost:3001`
- **Gateway** on `http://localhost:3000`

Wait for all services to be healthy (you'll see "Application startup complete" messages).

### Option B: Local Development (Without Docker)

If you prefer to run services locally:

#### Terminal 1 - AI Service:
```bash
cd services/ai-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
export OPENAI_API_KEY=your-key-here
uvicorn app.main:app --reload --port 8000
```

#### Terminal 2 - Test Executor:
```bash
cd services/test-executor
npm install
npm run build
export AI_SERVICE_URL=http://localhost:8000
npm start
```

#### Terminal 3 - Gateway:
```bash
cd gateway
npm install
npm run build
export AI_SERVICE_URL=http://localhost:8000
export TEST_EXECUTOR_URL=http://localhost:3001
npm start
```

## Step 3: Verify Services are Running

Check if services are healthy:

```bash
# Check AI Service
curl http://localhost:8000/health

# Check Test Executor
curl http://localhost:3001/health

# Check Gateway
curl http://localhost:3000/health
```

You should see `{"status": "healthy", ...}` responses.

## Step 4: Run Your First Test

### Using cURL

```bash
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to navigate to the website and see the homepage content",
    "headless": true
  }'
```

### Using Python

```python
import requests
import json

url = "http://localhost:3000/api/run-test"
payload = {
    "website_url": "https://example.com",
    "user_story": "As a user, I want to navigate to the website and see the homepage",
    "headless": True
}

response = requests.post(url, json=payload)
print(json.dumps(response.json(), indent=2))
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

async function runTest() {
  try {
    const response = await axios.post('http://localhost:3000/api/run-test', {
      website_url: 'https://example.com',
      user_story: 'As a user, I want to navigate to the website and see the homepage',
      headless: true
    });
    
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

runTest();
```

### Using Postman

1. Create a new POST request
2. URL: `http://localhost:3000/api/run-test`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "website_url": "https://example.com",
  "user_story": "As a user, I want to navigate to the website and see the homepage",
  "headless": true
}
```

## Step 5: Understanding the Response

The API returns a comprehensive result:

```json
{
  "success": true,
  "test_case": {
    "id": "test-abc123",
    "name": "User can navigate to homepage",
    "description": "Test navigation to homepage",
    "steps": [
      {
        "id": "step-001",
        "action": "navigate",
        "value": "https://example.com",
        "description": "Navigate to the website"
      },
      {
        "id": "step-002",
        "action": "assert",
        "target": {
          "text": "Example Domain"
        },
        "description": "Verify homepage content is visible"
      }
    ]
  },
  "execution_result": {
    "execution_id": "exec-xyz789",
    "status": "completed",
    "steps": [
      {
        "step_id": "step-001",
        "success": true,
        "execution_time_ms": 2345,
        "screenshot_path": "./screenshots/screenshot-step-001-1234567890.png"
      }
    ],
    "total_duration_ms": 5678,
    "screenshots": [
      "./screenshots/screenshot-step-001-1234567890.png"
    ]
  },
  "summary": {
    "test_name": "User can navigate to homepage",
    "total_steps": 2,
    "passed_steps": 2,
    "failed_steps": 0,
    "status": "completed",
    "duration_ms": 5678
  }
}
```

## Example Use Cases

### Example 1: Login Test

```bash
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com/login",
    "user_story": "As a user, I want to login to the website using my email and password",
    "headless": true
  }'
```

### Example 2: Search Functionality

```bash
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to search for products using the search bar",
    "headless": true
  }'
```

### Example 3: Form Submission

```bash
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com/contact",
    "user_story": "As a user, I want to fill out and submit the contact form",
    "headless": true
  }'
```

## Viewing Screenshots

Screenshots are saved in the `screenshots/` directory (or in Docker volumes). To view them:

```bash
# If using Docker
docker-compose exec test-executor ls -la /app/screenshots

# If running locally
ls -la services/test-executor/screenshots/
```

## Running in Non-Headless Mode

To see the browser in action:

```bash
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to navigate to the website",
    "headless": false
  }'
```

**Note:** This only works when running locally (not in Docker containers).

## Troubleshooting

### Services won't start

```bash
# Check Docker logs
docker-compose logs ai-service
docker-compose logs test-executor
docker-compose logs gateway

# Restart services
docker-compose restart
```

### API key errors

- Verify your API key is correct in `.env`
- Check API key has sufficient credits
- For OpenAI, ensure you have access to GPT-4

### Test execution fails

```bash
# Check if website is accessible
curl -I https://example.com

# View detailed error in response
# The API response includes error messages in the execution_result
```

### Element not found errors

- The system tries multiple selector strategies
- Check screenshots to see what the page looked like
- Try a more specific user story description
- Ensure the website is fully loaded (add wait steps)

## Advanced Usage

### Generate Tests Only (Without Execution)

```bash
curl -X POST http://localhost:3000/api/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to login"
  }'
```

### Direct Service Calls

You can also call services directly:

```bash
# Generate tests from AI service
curl -X POST http://localhost:8000/api/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "story": "As a user, I want to login",
    "website_url": "https://example.com"
  }'

# Execute test from test executor
curl -X POST http://localhost:3001/api/execute-test \
  -H "Content-Type: application/json" \
  -d @test-case.json
```

## Stopping Services

```bash
# Stop services (Docker)
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Next Steps

- Experiment with different user stories
- Try different websites
- Review generated test cases
- Check screenshots to understand element detection
- Modify prompts in `services/ai-service/app/application/test_generator.py` for better test generation

## Tips for Best Results

1. **Be specific in user stories**: "Click the login button" is better than "login"
2. **Include context**: Mention page names, element types when possible
3. **Start simple**: Begin with navigation tests before complex workflows
4. **Check screenshots**: They help understand what the system "sees"
5. **Use data-testid**: If you control the website, add `data-testid` attributes for best results





























