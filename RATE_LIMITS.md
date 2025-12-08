# Rate Limiting Configuration

## Current Limits (Default)

| Endpoint Type | Limit | Window | Environment Variable |
|--------------|-------|--------|---------------------|
| **Test Execution** | **10** | 1 hour | `RATE_LIMIT_TEST_EXECUTION_MAX` |
| Test Generation | 20 | 15 minutes | `RATE_LIMIT_TEST_GENERATION_MAX` |
| General API | 100 | 15 minutes | `RATE_LIMIT_MAX_REQUESTS` |

## Why These Limits Exist

1. **Resource Protection**: Test execution is resource-intensive:
   - Browser automation (Playwright)
   - AI service calls (LLM API costs)
   - Database writes
   - Network bandwidth

2. **Abuse Prevention**: Prevents:
   - Accidental infinite loops
   - Malicious usage
   - Resource exhaustion attacks

3. **Cost Control**: Limits AI service API costs

4. **Fair Usage**: Ensures fair access across all users

## How to Adjust Limits

### Option 1: Environment Variables (Recommended)

Create or update a `.env` file in the project root:

```bash
# Increase test execution limit to 50 per hour
RATE_LIMIT_TEST_EXECUTION_MAX=50

# Increase test generation limit to 50 per 15 minutes
RATE_LIMIT_TEST_GENERATION_MAX=50

# Increase general API limit to 200 per 15 minutes
RATE_LIMIT_MAX_REQUESTS=200
```

Then restart the gateway service:
```bash
docker compose restart gateway
```

### Option 2: Direct Docker Compose Update

The `docker-compose.yml` now supports these environment variables. You can set them directly:

```yaml
gateway:
  environment:
    - RATE_LIMIT_TEST_EXECUTION_MAX=50
    - RATE_LIMIT_TEST_GENERATION_MAX=50
    - RATE_LIMIT_MAX_REQUESTS=200
```

Then restart:
```bash
docker compose up -d gateway
```

### Option 3: For Development (Remove Limits)

For local development, you can set very high limits:

```bash
RATE_LIMIT_TEST_EXECUTION_MAX=1000
RATE_LIMIT_TEST_GENERATION_MAX=1000
RATE_LIMIT_MAX_REQUESTS=10000
```

## Understanding the Error

When you see: **"Too many test executions from this IP. Please wait before running more tests."**

This means:
- You've executed 10+ tests in the last hour from the same IP address
- The rate limit window is 1 hour
- You need to wait until the window resets, or increase the limit

## WebSocket Errors Connection

The WebSocket errors you're seeing are likely **consequences** of hitting the rate limit:

1. **Rate limit hit** → Test execution request is rejected (429 error)
2. **No execution starts** → WebSocket connection fails because there's no active execution
3. **Navigation error** → Browser never starts because the test was rate-limited

**Solution**: Increase the rate limit first, then the WebSocket errors should resolve.

## Checking Current Rate Limit Status

The API returns rate limit headers in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests in window
- `RateLimit-Reset`: Time when limit resets (Unix timestamp)

You can check these in the browser's Network tab when making API requests.

## Production Recommendations

For production environments:
- Keep test execution limits **low** (10-20/hour) to prevent abuse
- Implement **authentication** for higher limits
- Use **user-based rate limiting** instead of IP-based for authenticated users
- Monitor rate limit hits to adjust limits based on actual usage
