# API Documentation

Complete API reference for WhyNot Gateway.

## Base URL

- Development: `http://localhost:3000`
- Production: Configure based on your deployment

## Authentication

Currently, the API does not require authentication. In production, implement authentication middleware.

## Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Test Generation: 20 requests per 15 minutes per IP
- Test Execution: 10 requests per hour per IP

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests in window
- `RateLimit-Reset`: Time when limit resets

## Endpoints

### Health Check

**GET** `/health`

Returns service health status and dependency health.

**Response:**
```json
{
  "status": "healthy",
  "service": "gateway",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "dependencies": {
    "aiService": {
      "url": "http://ai-service:8000",
      "status": "healthy"
    },
    "testExecutor": {
      "url": "http://test-executor:3001",
      "status": "healthy"
    }
  }
}
```

### Generate Test Cases

**POST** `/api/generate-tests`

Generate test cases from a user story without executing them.

**Request Body:**
```json
{
  "website_url": "https://example.com",
  "user_story": "As a user, I want to login to the website",
  "additional_context": "Optional additional context"
}
```

**Response:**
```json
{
  "test_cases": [
    {
      "id": "uuid",
      "name": "Test Case Name",
      "description": "Test case description",
      "website_url": "https://example.com",
      "steps": [
        {
          "id": "step-1",
          "action": "navigate",
          "description": "Navigate to homepage",
          "target": null,
          "value": "https://example.com"
        }
      ]
    }
  ]
}
```

**Error Responses:**
- `400`: Validation error (invalid URL, empty user story, etc.)
- `429`: Rate limit exceeded
- `500`: Server error

### Run Complete Workflow

**POST** `/api/run-test`

Generate test cases and execute them in one request.

**Request Body:**
```json
{
  "website_url": "https://example.com",
  "user_story": "As a user, I want to login",
  "headless": true,
  "additional_context": "Optional"
}
```

**Response:**
```json
{
  "success": true,
  "test_case": { /* TestCase object */ },
  "execution_result": { /* ExecutionResult object */ },
  "summary": {
    "test_name": "Test Case Name",
    "total_steps": 5,
    "passed_steps": 4,
    "failed_steps": 1,
    "status": "failed",
    "duration_ms": 15000
  }
}
```

### Execute Test Case

**POST** `/api/execute-test?headless=true`

Execute a pre-generated test case.

**Request Body:**
```json
{
  "id": "test-case-uuid",
  "name": "Test Case Name",
  "website_url": "https://example.com",
  "steps": [ /* TestStep array */ ]
}
```

**Response:**
```json
{
  "execution_id": "uuid",
  "test_case_id": "uuid",
  "status": "completed",
  "steps": [ /* StepResult array */ ],
  "total_duration_ms": 15000,
  "screenshots": ["/screenshots/1.png"],
  "started_at": "2024-01-01T00:00:00.000Z",
  "completed_at": "2024-01-01T00:00:15.000Z"
}
```

### Get Test Case

**GET** `/api/test-cases/:id`

Retrieve a test case by ID.

**Response:**
```json
{
  "id": "uuid",
  "name": "Test Case Name",
  "description": "Description",
  "website_url": "https://example.com",
  "user_story": "User story text",
  "steps": [ /* JSONB steps */ ],
  "metadata": {},
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### List Test Cases

**GET** `/api/test-cases?offset=0&limit=50`

List test cases with pagination.

**Query Parameters:**
- `offset` (default: 0): Number of records to skip
- `limit` (default: 50, max: 100): Number of records to return

**Response:**
```json
{
  "test_cases": [ /* TestCase array */ ],
  "offset": 0,
  "limit": 50
}
```

### Get Execution

**GET** `/api/executions/:id`

Get execution details with step results.

**Response:**
```json
{
  "execution": {
    "id": "uuid",
    "test_case_id": "uuid",
    "status": "completed",
    "started_at": "2024-01-01T00:00:00.000Z",
    "completed_at": "2024-01-01T00:00:15.000Z",
    "total_duration_ms": 15000,
    "error": null,
    "screenshots": []
  },
  "steps": [
    {
      "id": "uuid",
      "execution_id": "uuid",
      "step_id": "step-1",
      "success": true,
      "execution_time_ms": 1000,
      "error": null,
      "screenshot_path": null,
      "element_found": true,
      "selector_used": { /* ElementSelector */ }
    }
  ]
}
```

### List Executions

**GET** `/api/executions?offset=0&limit=50`

List executions with pagination.

**Response:**
```json
{
  "executions": [ /* ExecutionEntity array */ ],
  "offset": 0,
  "limit": 50
}
```

### Metrics

**GET** `/metrics`

Get service metrics (counters and histograms).

**Response:**
```json
{
  "service": "gateway",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "counters": {
    "workflow_completed{status=completed}": 100,
    "workflow_completed{status=failed}": 5
  },
  "histograms": {
    "workflow_duration{status=completed}": {
      "count": 100,
      "sum": 1500000,
      "avg": 15000,
      "min": 5000,
      "max": 30000
    }
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

In development, additional fields may be included:
- `stack`: Error stack trace
- `details`: Additional error details

## Status Codes

- `200`: Success
- `400`: Bad Request (validation error)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error
- `503`: Service Unavailable (degraded health)

























