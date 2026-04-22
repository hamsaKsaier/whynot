# Testing Guide

All tests run inside Docker. There is no host-node test path.

## Quick Start

```bash
# Run all gateway tests (unit + integration)
docker compose -f docker-compose.test.yml run --rm gateway-test

# Run frontend unit tests
docker compose -f docker-compose.test.yml run --rm frontend-test

# Run admin frontend unit tests
docker compose -f docker-compose.test.yml run --rm admin-frontend-test

# Run shared library tests
docker compose -f docker-compose.test.yml run --rm shared-test

# Run Playwright e2e tests
docker compose -f docker-compose.test.yml up -d postgres-test
docker compose -f docker-compose.test.yml run --rm playwright

# Tear down test containers
docker compose -f docker-compose.test.yml down -v
```

## Adding Coverage

Append `--coverage` to any vitest command:

```bash
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage
```

Coverage reports are generated in each package's `coverage/` directory in three formats: text (console), lcov, and HTML.

## Writing a New Test

### Unit test (gateway or services)

Create a file matching `src/**/*.test.ts` in the relevant package:

```ts
import { describe, it, expect } from 'vitest';

describe('myFeature', () => {
  it('does the thing', () => {
    expect(true).toBe(true);
  });
});
```

### Unit test (frontend)

Create a file matching `src/**/*.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('renders', () => {
    render(<MyComponent />);
    expect(screen.getByText('expected text')).toBeInTheDocument();
  });
});
```

### E2E test (Playwright)

Create a file in `frontend/e2e/` or `admin-frontend/e2e/` matching `*.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/expected/i);
});
```

### API test (supertest)

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../api/main';

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
```

## Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration test runner |
| @testing-library/react | React component testing |
| supertest | HTTP assertion for Express |
| nock | HTTP mocking (Stripe, LLM providers) |
| Playwright | Browser-based E2E tests |
| @axe-core/playwright | Accessibility testing |
| Lighthouse | Performance auditing |

## Configuration Files

| File | Purpose |
|------|---------|
| `gateway/vitest.config.ts` | Gateway test config |
| `frontend/vitest.config.ts` | Frontend unit test config |
| `admin-frontend/vitest.config.ts` | Admin frontend unit test config |
| `shared/vitest.config.ts` | Shared library test config |
| `frontend/playwright.config.ts` | Frontend E2E config |
| `admin-frontend/playwright.config.ts` | Admin frontend E2E config |
| `docker-compose.test.yml` | Docker services for testing |
| `.env.test` | Test environment variables |
