# How to Run Tests in Browser Mode (Non-Headless)

Browser mode allows you to see the test execution in real-time with a live browser preview. This is useful for debugging and understanding what the test is doing.

## Method 1: Using the UI (Recommended)

1. **On the Home Page:**
   - Fill in the "Website URL" field
   - Fill in the "User Story" field
   - **Uncheck the "Run in headless mode" checkbox** (this enables browser mode)
   - Click "Run Test" or "Generate Tests"

2. **When Test Execution Starts:**
   - The UI will automatically switch to the Test Execution View
   - You'll see three panes:
     - **Left Pane**: Test steps list with progress
     - **Center Pane**: Test details and controls
     - **Right Pane**: Live browser preview (only visible when headless=false)

3. **Browser Preview Features:**
   - Real-time browser view updates
   - Browser controls (back, forward, refresh, zoom)
   - URL bar showing current page
   - Browser selector (Chrome, Firefox, Safari)
   - Resolution selector

## Method 2: Using the API Directly

### Execute Test with Browser Mode

```bash
curl -X POST "http://localhost:3000/api/execute-test?headless=false" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-case-id",
    "name": "Test Case Name",
    "website_url": "https://example.com",
    "steps": [...]
  }'
```

### Run Complete Workflow with Browser Mode

```bash
curl -X POST "http://localhost:3000/api/run-test" \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to...",
    "headless": false
  }'
```

## Method 3: Programmatically (Frontend)

```typescript
import { executeTest } from './services/api';

// Run test in browser mode (headless=false)
const result = await executeTest(testCase, false);
```

## Important Notes

1. **WebSocket Connection**: Browser mode requires a WebSocket connection for live streaming. The frontend automatically connects to `ws://localhost:3001/ws/browser-stream/:executionId` when headless=false.

2. **Performance**: Browser mode is slower than headless mode because it renders the browser UI and streams frames in real-time.

3. **Docker Environment**: If running in Docker, make sure:
   - The test-executor service has WebSocket support enabled (port 3001)
   - The frontend can connect to the WebSocket server
   - X11 display is available if running on Linux (usually not needed in Docker)

4. **Browser Preview**: The live browser preview will only appear when:
   - `headless=false` is set
   - The test execution is running or has completed
   - WebSocket connection is established

## Troubleshooting

### Browser Preview Not Showing

1. Check that `headless=false` is set
2. Verify WebSocket connection in browser console
3. Check test-executor logs for WebSocket errors
4. Ensure execution ID is available (check execution result)

### WebSocket Connection Failed

1. Verify test-executor service is running: `docker compose ps`
2. Check WebSocket port is accessible: `curl http://localhost:3001/health`
3. Check browser console for WebSocket errors
4. Verify execution ID matches between API response and WebSocket connection

### Validation Errors

If you see validation errors about `wait_time` or `value` being null:
- The validation schema now accepts `null` values for optional fields
- Make sure you're using the latest gateway service (restart if needed)

## Example: Complete Workflow

1. **Start Services:**
   ```bash
   docker compose up -d
   ```

2. **Open Frontend:**
   - Navigate to `http://localhost:5173`

3. **Run Test in Browser Mode:**
   - Enter URL: `https://example.com`
   - Enter user story: `As a user, I want to see the homepage`
   - **Uncheck "Run in headless mode"**
   - Click "Run Test"

4. **Watch Live Execution:**
   - See browser preview update in real-time
   - Watch steps execute one by one
   - See screenshots and results

## Differences: Headless vs Browser Mode

| Feature | Headless Mode | Browser Mode |
|---------|--------------|--------------|
| Speed | Faster | Slower |
| Visibility | No visual feedback | Live browser preview |
| Debugging | Limited | Full visibility |
| Resource Usage | Lower | Higher |
| WebSocket | Not needed | Required |
| Use Case | CI/CD, automation | Development, debugging |

























