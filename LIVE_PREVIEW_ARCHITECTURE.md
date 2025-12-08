# Live Browser Preview Architecture

## How Thunder/Cypress/Playwright UI Implements Live Preview

Tools like Thunder, Cypress, and Playwright Test UI use the following pattern for live browser preview:

### 1. **Immediate Execution ID Return**
- Generate execution ID **before** test starts
- Return execution ID to frontend **immediately**
- Frontend connects to WebSocket **right away**

### 2. **Asynchronous Test Execution**
- Test runs in background (non-blocking)
- Updates streamed via WebSocket in real-time
- Results returned when complete

### 3. **WebSocket Streaming Pattern**
```
Frontend Request → Backend
  ↓
Backend generates executionId
  ↓
Backend returns { executionId, status: 'starting' } IMMEDIATELY
  ↓
Frontend connects: ws://server/ws/browser-stream/{executionId}
  ↓
Backend starts test execution (async)
  ↓
Backend creates BrowserStreamer with executionId
  ↓
BrowserStreamer registers with WebSocket handler
  ↓
WebSocket handler attaches streamer to connection
  ↓
Streaming starts: frames sent every 100ms
  ↓
Test completes → streamer stops → connection closes
```

### 4. **Frame Capture Method**
- Use Playwright's `page.screenshot()` in a loop
- Capture at intervals (100-200ms)
- Encode as base64 PNG
- Send via WebSocket as JSON: `{ type: 'frame', frame: 'base64...', url: '...', timestamp: ... }`

### 5. **Connection Timing**
- **Critical**: Streamer must be registered BEFORE WebSocket connects OR
- WebSocket connection must wait for streamer (our current approach)
- Best: Return executionId immediately, start test async, frontend connects early

## Our Current Implementation Issues

1. ❌ Execution ID only returned AFTER test completes
2. ❌ Frontend can't connect until test is done
3. ❌ Streamer cleaned up before WebSocket connects
4. ✅ WebSocket server setup is correct
5. ✅ Frame capture logic is correct

## Solution: Return Execution ID Immediately

### Backend Changes Needed:

1. **Modify `/api/execute-test` endpoint:**
   - Generate executionId immediately
   - Return `{ executionId, status: 'starting' }` right away
   - Start test execution asynchronously
   - Stream updates via WebSocket

2. **Alternative: Use Server-Sent Events (SSE) or WebSocket for status**
   - Return executionId immediately
   - Use WebSocket for both status updates AND frames
   - Frontend subscribes to executionId channel

### Recommended Approach:

**Option A: Immediate Response with Async Execution (Best)**
```typescript
// Backend
app.post('/api/execute-test', async (req, res) => {
  const executionId = uuidv4();
  
  // Return immediately
  res.json({ 
    executionId, 
    status: 'starting',
    message: 'Test execution started. Connect to WebSocket for live preview.'
  });
  
  // Run test asynchronously
  testRunner.runTest(testCase, headless, executionId)
    .then(result => {
      // Update via WebSocket or store in DB
    })
    .catch(error => {
      // Handle error
    });
});
```

**Option B: WebSocket for Everything (Alternative)**
- Single WebSocket connection
- Send executionId first
- Stream frames and status updates
- More complex but more real-time

## Implementation Priority

1. ✅ Fix build errors (TypeScript compilation)
2. ✅ Return executionId immediately
3. ✅ Start test execution asynchronously  
4. ✅ Ensure WebSocket connects before test completes
5. ✅ Test with longer-running tests first









