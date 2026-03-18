# Troubleshooting Guide

Common issues and solutions for WhyNot.

## Database Connection Issues

### Error: "Connection refused" or "ECONNREFUSED"

**Symptoms:**
- Services fail to start
- Database queries fail
- Health checks show database as unhealthy

**Solutions:**
1. Verify database service is running:
   ```bash
   docker compose ps database
   ```

2. Check database logs:
   ```bash
   docker compose logs database
   ```

3. Verify DATABASE_URL environment variable:
   ```bash
   docker compose exec gateway env | grep DATABASE_URL
   ```

4. Ensure database service is healthy before starting dependent services:
   ```bash
   docker compose up -d database
   # Wait for health check
   docker compose up -d gateway test-executor
   ```

### Error: "password authentication failed"

**Solutions:**
1. Check POSTGRES_PASSWORD in `.env` matches docker-compose.yml
2. Reset database password:
   ```bash
   docker compose down -v
   # Update .env with new password
   docker compose up -d
   ```

## Test Execution Issues

### Error: "Page crashed" during test execution

**Symptoms:**
- Tests fail with browser crash errors
- Playwright browser fails to start

**Solutions:**
1. Check Playwright dependencies are installed:
   ```bash
   docker compose exec test-executor npx playwright install-deps chromium
   ```

2. Increase browser memory limits in docker-compose.yml:
   ```yaml
   test-executor:
     deploy:
       resources:
         limits:
           memory: 2G
   ```

3. Verify browser launch arguments in `playwright-controller.ts` include:
   - `--no-sandbox`
   - `--disable-dev-shm-usage`
   - `--disable-gpu`

### Error: "Element not found"

**Symptoms:**
- Steps fail with element not found errors
- Selectors fail to locate elements

**Solutions:**
1. Check if element is dynamically loaded - retry logic should handle this
2. Verify website is accessible and loads correctly
3. Check screenshots to see page state
4. Review selector strategy in logs

### Error: "Navigation timeout"

**Symptoms:**
- Page navigation times out
- Tests fail during page load

**Solutions:**
1. Increase navigation timeout in `playwright-controller.ts`
2. Check if website is slow or unresponsive
3. Verify network connectivity from container
4. Check if website requires authentication

## AI Service Issues

### Error: "Failed to generate test cases"

**Symptoms:**
- Test generation fails
- AI service returns errors

**Solutions:**
1. Verify API key is set:
   ```bash
   docker compose exec ai-service env | grep OPENAI_API_KEY
   ```

2. Check AI service logs:
   ```bash
   docker compose logs ai-service
   ```

3. Verify API key is valid and has credits
4. Check rate limits on AI provider

### Error: "Circuit breaker is OPEN"

**Symptoms:**
- Requests fail immediately
- Service shows circuit breaker errors

**Solutions:**
1. Circuit breaker opens after 5 consecutive failures
2. Wait for reset timeout (default 60 seconds)
3. Check underlying service health
4. Manually reset by restarting service:
   ```bash
   docker compose restart gateway
   ```

## Rate Limiting Issues

### Error: "Too many requests"

**Symptoms:**
- API returns 429 status
- Rate limit headers show limit exceeded

**Solutions:**
1. Wait for rate limit window to reset
2. Adjust rate limits in `.env`:
   ```
   RATE_LIMIT_MAX_REQUESTS=200
   RATE_LIMIT_TEST_EXECUTION_MAX=20
   ```
3. Use different IP addresses for testing
4. Implement authentication for higher limits

## Logging Issues

### No logs appearing

**Solutions:**
1. Check LOG_LEVEL environment variable:
   ```bash
   docker compose exec gateway env | grep LOG_LEVEL
   ```

2. Set LOG_LEVEL to debug for more verbose logging:
   ```
   LOG_LEVEL=debug
   ```

3. Check service logs:
   ```bash
   docker compose logs -f gateway
   ```

## Performance Issues

### Slow test execution

**Solutions:**
1. Check database performance:
   ```bash
   docker compose exec database psql -U whynot -d whynot -c "SELECT * FROM pg_stat_activity;"
   ```

2. Increase service resources in docker-compose.yml
3. Check for database connection pool exhaustion
4. Review metrics endpoint for bottlenecks

### High memory usage

**Solutions:**
1. Limit screenshot storage:
   - Set `ENABLE_SCREENSHOTS=false` to disable
   - Implement screenshot cleanup job
2. Adjust database connection pool size
3. Monitor and limit concurrent test executions

## Health Check Failures

### Service shows as "degraded"

**Solutions:**
1. Check health endpoint for details:
   ```bash
   curl http://localhost:3000/health
   ```

2. Verify all dependencies are healthy
3. Check service logs for errors
4. Restart unhealthy services:
   ```bash
   docker compose restart <service-name>
   ```

## Database Migration Issues

### Migrations not running

**Solutions:**
1. Verify migration file is in correct location:
   ```
   services/database/migrations/001_initial_schema.sql
   ```

2. Check database logs for migration errors
3. Manually run migrations:
   ```bash
   docker compose exec database psql -U whynot -d whynot -f /docker-entrypoint-initdb.d/001_initial_schema.sql
   ```

## General Debugging

### View all service logs

```bash
docker compose logs -f
```

### View specific service logs

```bash
docker compose logs -f gateway
docker compose logs -f test-executor
docker compose logs -f ai-service
docker compose logs -f database
```

### Restart all services

```bash
docker compose restart
```

### Rebuild and restart

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Access service shell

```bash
docker compose exec gateway sh
docker compose exec test-executor sh
```

### Check service status

```bash
docker compose ps
```

### View resource usage

```bash
docker stats
```

## Getting Help

If issues persist:

1. Check service logs for detailed error messages
2. Review health check endpoints for service status
3. Verify all environment variables are set correctly
4. Ensure all services are running and healthy
5. Check Docker and system resources

For additional support, review the main README.md and API.md documentation.

























