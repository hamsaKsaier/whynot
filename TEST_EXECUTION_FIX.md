# Test Execution Errors - Diagnosis & Fix

## ❌ **DO NOT DELETE YOUR TEST CASES!**

The errors you're seeing are **NOT** caused by your test cases. Regenerating test cases will **NOT** fix the problem.

## 🔍 What's Actually Wrong

The errors you're experiencing are **infrastructure/runtime issues**:

1. **WebSocket Connection Errors** - The frontend can't connect to the test-executor service's WebSocket server
2. **Navigation Errors (`net::ERR_ABORTED`)** - The browser is failing to navigate to test URLs, often because:
   - The browser crashes or closes prematurely
   - Network connectivity issues
   - Browser resource constraints

## ✅ What I Fixed

I've improved the error handling in the browser-streamer to:
- Stop trying to capture frames when the browser is closed
- Handle "page closed" errors gracefully
- Prevent log spam from repeated errors

## 🛠️ What You Should Do

### Step 1: Check Service Status

Run the diagnostic script I created:

```bash
./check-services.sh
```

This will tell you if services are running and accessible.

### Step 2: Restart Services

If services show as unhealthy or not accessible:

```bash
# Restart all services
docker compose restart

# Or restart just the test-executor (most likely culprit)
docker compose restart test-executor
```

### Step 3: Check Logs

If issues persist, check the logs:

```bash
# Check test-executor logs for errors
docker compose logs test-executor --tail 100

# Check for WebSocket errors specifically
docker compose logs test-executor | grep -i websocket

# Check for navigation errors
docker compose logs test-executor | grep -i navigation
```

### Step 4: Rebuild Services (if needed)

If restarting doesn't help:

```bash
# Rebuild and restart test-executor
docker compose up --build -d test-executor

# Or rebuild everything
docker compose down
docker compose up --build -d
```

### Step 5: Verify Services Are Healthy

After restarting, verify all services are healthy:

```bash
# Check health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:8000/health
```

All should return `"status": "healthy"`.

## 🎯 Common Causes & Solutions

### Issue: WebSocket Connection Failed

**Symptoms:**
- `WebSocket error: Event {...}`
- `WebSocket connection error`

**Solutions:**
1. Ensure test-executor service is running: `docker compose ps test-executor`
2. Check if port 3001 is accessible: `curl http://localhost:3001/health`
3. Restart test-executor: `docker compose restart test-executor`
4. Check firewall/network settings if running in a restricted environment

### Issue: Navigation Error (net::ERR_ABORTED)

**Symptoms:**
- `Navigation error: page.goto: net::ERR_ABORTED`
- Browser preview shows `about:blank`

**Solutions:**
1. **Check if the website URL is accessible:**
   ```bash
   curl -I https://example.com
   ```

2. **Check browser logs for crashes:**
   ```bash
   docker compose logs test-executor | grep -i "crashed\|closed"
   ```

3. **Try running in headless mode first** (bypasses WebSocket):
   - This helps isolate if the issue is with WebSocket or the actual test execution

4. **Check Docker resources:**
   ```bash
   docker stats
   ```
   - Ensure you have enough memory/CPU allocated

5. **Increase browser timeout** (if website is slow):
   - The navigation timeout is currently 60 seconds
   - Very slow websites might need more time

## 🧪 Testing After Fix

1. **Try a simple test first:**
   - Use a well-known website like `https://example.com`
   - Use a simple user story

2. **Try headless mode:**
   - This bypasses WebSocket and helps verify if the core test execution works

3. **Check the browser console:**
   - Open Chrome DevTools (F12)
   - Look for specific error messages
   - Share these errors if issues persist

## 📋 Summary

- ✅ **Fixed:** Browser-streamer error handling (stops gracefully when browser closes)
- ❌ **Not Fixed (by design):** Your test cases are fine - don't delete them!
- 🔧 **Action Required:** Restart services and verify they're healthy

## 🆘 Still Having Issues?

If problems persist after following these steps:

1. **Check service logs:**
   ```bash
   docker compose logs -f test-executor
   ```

2. **Verify environment variables:**
   ```bash
   docker compose exec test-executor env | grep -E "PORT|AI_SERVICE|DATABASE"
   ```

3. **Check Docker resources:**
   ```bash
   docker stats
   ```

4. **Review the troubleshooting guide:**
   ```bash
   cat docs/TROUBLESHOOTING.md
   ```

## 💡 Key Takeaway

**Your test cases are NOT the problem.** The errors are from:
- Services not running properly
- Browser crashes during navigation
- WebSocket connection issues

Regenerating test cases will waste time and won't solve anything. Focus on getting the services running properly first.
















