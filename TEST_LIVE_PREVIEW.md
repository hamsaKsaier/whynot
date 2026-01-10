# Testing Live Browser Preview

## Prerequisites

✅ All services are running:
- `docker compose ps` should show all services as "Up"
- Test-executor should show "WebSocket server started" in logs

## Step-by-Step Test Guide

### 1. Open the Frontend
- Navigate to: http://localhost:5173
- You should see the test input form

### 2. Generate Test Cases
1. Enter a website URL (e.g., `https://example.com`)
2. Enter a user story (e.g., "Click on the first link")
3. Click "Generate Tests"
4. Wait for test cases to be generated

### 3. Run Test with Live Preview (headless=false)
1. **IMPORTANT**: Make sure `headless` mode is set to **OFF** (unchecked)
2. Click "Run Test" on one of the generated test cases
3. You should see:
   - **Immediate response**: Execution ID returned immediately
   - **WebSocket connection**: Browser console should show "Attempting WebSocket connection"
   - **Live preview pane**: Should appear on the right side
   - **Real-time frames**: Browser frames updating every 100ms

### 4. What to Look For

#### In Browser Console (F12):
```
Attempting WebSocket connection { wsUrlFull: "ws://localhost:3001/ws/browser-stream/...", executionId: "..." }
WebSocket connected
```

#### In Test Execution View:
- **Left pane**: Test steps list with status indicators
- **Center pane**: Test details and controls
- **Right pane**: Live browser preview showing:
  - Real-time browser frames
  - Current URL
  - Browser controls (if implemented)

#### In Test-Executor Logs:
```bash
docker compose logs test-executor -f
```
You should see:
- "WebSocket connection established"
- "Browser streaming setup for non-headless mode"
- Frame capture messages

### 5. Troubleshooting

#### WebSocket Connection Fails
**Error**: "Failed to connect to WebSocket server"

**Check**:
1. Test-executor is running: `docker compose ps test-executor`
2. Port 3001 is accessible: `curl http://localhost:3001/health`
3. WebSocket server started: Check logs for "WebSocket server started"
4. Execution ID is valid: Should be a UUID format

**Fix**:
- Restart test-executor: `docker compose restart test-executor`
- Check browser console for connection errors
- Verify WebSocket URL in browser console logs

#### No Frames Appearing
**Check**:
1. Test is actually running (not headless mode)
2. BrowserStreamer is registered: Check test-executor logs
3. WebSocket is sending frames: Check browser console for frame messages
4. Frontend is receiving frames: Check React DevTools state

**Fix**:
- Ensure `headless=false` when running test
- Check test-executor logs for "Starting browser frame streaming"
- Verify WebSocket connection is open (check browser console)

#### Test Completes Before Preview Shows
**This should be fixed now** - execution ID is returned immediately, so WebSocket should connect before test starts.

If it still happens:
- Check that backend returns executionId immediately (not after test completes)
- Verify frontend connects to WebSocket right after getting executionId
- Check timing in browser console logs

### 6. Expected Flow

```
1. User clicks "Run Test" with headless=false
   ↓
2. Frontend sends POST /api/execute-test?headless=false
   ↓
3. Backend immediately returns: { execution_id: "...", status: "starting" }
   ↓
4. Frontend receives executionId and connects to WebSocket:
   ws://localhost:3001/ws/browser-stream/{executionId}
   ↓
5. Backend starts test execution (async)
   ↓
6. BrowserStreamer is created and registered
   ↓
7. WebSocket handler attaches streamer to connection
   ↓
8. Streaming starts: frames sent every 100ms
   ↓
9. Frontend displays frames in real-time
   ↓
10. Test completes → final result sent via WebSocket
   ↓
11. Frontend updates with final execution result
```

### 7. Testing Commands

```bash
# Check all services
docker compose ps

# Watch test-executor logs
docker compose logs test-executor -f

# Watch gateway logs
docker compose logs gateway -f

# Restart test-executor if needed
docker compose restart test-executor

# Rebuild if code changes
docker compose build test-executor
docker compose up -d test-executor
```

### 8. Success Indicators

✅ **WebSocket connects immediately** (within 1 second)
✅ **Frames appear in preview** (within 2-3 seconds)
✅ **Frames update smoothly** (every 100ms)
✅ **Test execution visible** in real-time
✅ **Final result received** via WebSocket when test completes

## Next Steps After Testing

If everything works:
- ✅ Live preview is functional!
- Consider adding browser controls (zoom, refresh, etc.)
- Consider adding step-by-step navigation
- Consider adding screenshot capture on demand

If issues persist:
- Check the troubleshooting section above
- Review browser console errors
- Review test-executor logs
- Verify WebSocket URL configuration

























