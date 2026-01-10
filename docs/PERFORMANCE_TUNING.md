# Performance Tuning Guide

This guide helps you optimize the system performance, especially for resource-constrained environments or when experiencing timeout issues.

## Common Performance Issues

### Screenshot Timeouts

**Symptom:** `page.screenshot: Timeout 60000ms exceeded. Call log: - taking page screenshot - waiting for fonts to load...`

**Causes:**
- Limited CPU/RAM resources
- Font loading wait (Playwright waits for fonts by default)
- Slow network connections
- Heavy web pages with many resources

**Solutions:**

1. **Increase Timeouts (Recommended for resource-constrained environments)**
   ```bash
   # In docker-compose.yml or .env file
   SCREENSHOT_TIMEOUT_MS=180000  # 3 minutes
   NAVIGATION_TIMEOUT_MS=120000  # 2 minutes
   NAVIGATION_MAX_TIMEOUT_MS=180000  # 3 minutes
   ```

2. **Font Loading is Already Disabled**
   - The system automatically sets `PW_TEST_SCREENSHOT_NO_FONTS_READY=1`
   - This prevents Playwright from waiting for fonts to load

3. **Resource Limits**
   - Ensure your Docker container has sufficient resources
   - Default limits: 2 CPUs, 4GB RAM
   - Adjust in `docker-compose.yml`:
     ```yaml
     deploy:
       resources:
         limits:
           cpus: '4.0'      # Increase for better performance
           memory: 8G       # Increase for better performance
     ```

## Environment Variables

### Timeout Configuration

| Variable | Default | Max | Description |
|----------|---------|-----|-------------|
| `SCREENSHOT_TIMEOUT_MS` | 120000 (2 min) | 180000 (3 min) | Screenshot capture timeout |
| `NAVIGATION_TIMEOUT_MS` | 90000 (1.5 min) | 180000 (3 min) | Page navigation timeout |
| `NAVIGATION_MAX_TIMEOUT_MS` | 180000 (3 min) | 300000 (5 min) | Maximum navigation timeout |

### Resource Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_EXECUTOR_CPUS` | 2.0 | CPU limit for test-executor |
| `TEST_EXECUTOR_MEMORY` | 4G | Memory limit for test-executor |
| `TEST_EXECUTOR_CPUS_RESERVED` | 1.0 | Reserved CPUs |
| `TEST_EXECUTOR_MEMORY_RESERVED` | 2G | Reserved memory |

## Performance Optimization Strategies

### 1. Local Development (Limited Resources)

**Recommended Settings:**
```bash
# .env file
SCREENSHOT_TIMEOUT_MS=180000
NAVIGATION_TIMEOUT_MS=120000
TEST_EXECUTOR_CPUS=2.0
TEST_EXECUTOR_MEMORY=4G
```

**Tips:**
- Use headless mode (default in Docker)
- Close other resource-intensive applications
- Consider using a remote server for better performance

### 2. Production/Remote Hosting

**Recommended Settings:**
```bash
# .env file
SCREENSHOT_TIMEOUT_MS=120000
NAVIGATION_TIMEOUT_MS=90000
TEST_EXECUTOR_CPUS=4.0
TEST_EXECUTOR_MEMORY=8G
```

**Server Requirements:**
- Minimum: 2 CPUs, 4GB RAM
- Recommended: 4 CPUs, 8GB RAM
- For heavy workloads: 8+ CPUs, 16GB+ RAM

### 3. Docker Resource Limits

Edit `docker-compose.yml`:

```yaml
test-executor:
  deploy:
    resources:
      limits:
        cpus: '4.0'      # Adjust based on your server
        memory: 8G       # Adjust based on your server
      reservations:
        cpus: '2.0'
        memory: 4G
```

## Browser Performance Optimizations

The system automatically applies these optimizations:

1. **Font Loading Disabled**
   - `PW_TEST_SCREENSHOT_NO_FONTS_READY=1` prevents font wait timeouts
   - Significantly improves screenshot performance

2. **Chrome Performance Flags**
   - Disabled unnecessary features (extensions, plugins, sync)
   - Reduced memory usage
   - Optimized rendering

3. **Page-Level Timeouts**
   - Default timeout: 120 seconds
   - Navigation timeout: 120 seconds
   - Prevents indefinite hangs

## Troubleshooting

### Still Getting Timeouts?

1. **Check System Resources**
   ```bash
   # Check Docker container resources
   docker stats
   
   # Check system resources
   htop  # or top
   ```

2. **Increase Timeouts Further**
   ```bash
   SCREENSHOT_TIMEOUT_MS=300000  # 5 minutes (max recommended)
   NAVIGATION_TIMEOUT_MS=180000   # 3 minutes
   ```

3. **Check Network Speed**
   - Slow network connections can cause timeouts
   - Test the website URL directly in a browser
   - Consider using a faster network connection

4. **Monitor Logs**
   ```bash
   # Check test-executor logs
   docker compose logs -f test-executor
   ```

5. **Consider Remote Hosting**
   - If local resources are too limited
   - Use a cloud server (AWS, GCP, Azure, etc.)
   - Recommended: 4+ CPUs, 8GB+ RAM

### Performance Monitoring

Monitor these metrics:

1. **CPU Usage**
   - Should stay below 80% under normal load
   - If consistently high, increase CPU limits

2. **Memory Usage**
   - Should stay below 80% of allocated memory
   - If consistently high, increase memory limits

3. **Screenshot Success Rate**
   - Monitor timeout errors in logs
   - If frequent, increase `SCREENSHOT_TIMEOUT_MS`

4. **Execution Time**
   - Normal: 30-60 seconds per test
   - Slow: 2+ minutes per test (may need optimization)
   - Very slow: 5+ minutes (likely resource constraints)

## Best Practices

1. **Start with Defaults**
   - Default settings work for most environments
   - Only adjust if experiencing issues

2. **Gradual Tuning**
   - Increase timeouts incrementally
   - Test after each change
   - Don't set timeouts too high (masks real issues)

3. **Resource Planning**
   - Allocate resources based on expected load
   - Leave headroom for peak usage
   - Monitor and adjust as needed

4. **Use Headless Mode**
   - Always use headless mode in Docker (default)
   - Non-headless mode uses more resources

5. **Optimize Test Cases**
   - Keep test cases focused
   - Avoid unnecessary waits
   - Use efficient selectors

## Quick Reference

### Quick Fix for Timeout Issues

```bash
# Add to .env file or docker-compose.yml environment section
SCREENSHOT_TIMEOUT_MS=180000
NAVIGATION_TIMEOUT_MS=120000
NAVIGATION_MAX_TIMEOUT_MS=180000

# Restart services
docker compose down
docker compose up -d
```

### Check Current Settings

```bash
# Check environment variables
docker compose exec test-executor env | grep -E "(TIMEOUT|SCREENSHOT)"

# Check resource limits
docker inspect $(docker compose ps -q test-executor) | grep -A 10 Resources
```

## When to Use Remote Hosting

Consider remote hosting if:
- Local machine has < 4GB RAM
- Local machine has < 2 CPUs
- Frequent timeout errors even with increased timeouts
- Need to run multiple tests concurrently
- Production environment requirements

## Additional Resources

- [Docker Resource Limits Documentation](https://docs.docker.com/config/containers/resource_constraints/)
- [Playwright Performance Best Practices](https://playwright.dev/docs/best-practices)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)











