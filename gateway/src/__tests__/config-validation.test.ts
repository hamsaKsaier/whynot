import { describe, it, expect } from 'vitest';
import { envSchema } from '../config/env';

/**
 * Tests for the gateway environment configuration schema.
 *
 * These tests validate the Zod schema directly — they do NOT import
 * the `env` singleton (which would trigger process.exit on failure).
 */

/** Minimal valid env — only the truly required fields. */
function validEnv(): Record<string, string> {
  return {
    JWT_SECRET: 'test-secret-long-enough',
  };
}

describe('envSchema — required fields', () => {
  it('passes with minimal valid env', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
  });

  it('fails when JWT_SECRET is missing', () => {
    const input = validEnv();
    delete input.JWT_SECRET;
    const result = envSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('JWT_SECRET');
    }
  });

  it('fails when JWT_SECRET is empty string', () => {
    const result = envSchema.safeParse({ ...validEnv(), JWT_SECRET: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('JWT_SECRET');
    }
  });
});

describe('envSchema — type coercion', () => {
  it('coerces PORT from string to number', () => {
    const result = envSchema.safeParse({ ...validEnv(), PORT: '4000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
      expect(typeof result.data.PORT).toBe('number');
    }
  });

  it('coerces RATE_LIMIT_MAX_REQUESTS from string to number', () => {
    const result = envSchema.safeParse({
      ...validEnv(),
      RATE_LIMIT_MAX_REQUESTS: '500',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_MAX_REQUESTS).toBe(500);
      expect(typeof result.data.RATE_LIMIT_MAX_REQUESTS).toBe('number');
    }
  });

  it('coerces SCREENSHOT_RETENTION_DAYS from string to number', () => {
    const result = envSchema.safeParse({
      ...validEnv(),
      SCREENSHOT_RETENTION_DAYS: '60',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SCREENSHOT_RETENTION_DAYS).toBe(60);
    }
  });

  it('coerces PAGE_CAPTURE_TIMEOUT_MS from string to number', () => {
    const result = envSchema.safeParse({
      ...validEnv(),
      PAGE_CAPTURE_TIMEOUT_MS: '30000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PAGE_CAPTURE_TIMEOUT_MS).toBe(30000);
    }
  });

  it('coerces ALLOW_INTERNAL_SCAN "true" to boolean true', () => {
    const result = envSchema.safeParse({
      ...validEnv(),
      ALLOW_INTERNAL_SCAN: 'true',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ALLOW_INTERNAL_SCAN).toBe(true);
      expect(typeof result.data.ALLOW_INTERNAL_SCAN).toBe('boolean');
    }
  });

  it('coerces ALLOW_INTERNAL_SCAN "false" to boolean false', () => {
    const result = envSchema.safeParse({
      ...validEnv(),
      ALLOW_INTERNAL_SCAN: 'false',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ALLOW_INTERNAL_SCAN).toBe(false);
    }
  });

  it('coerces ALLOW_INTERNAL_SCAN "1" to boolean true', () => {
    const result = envSchema.safeParse({
      ...validEnv(),
      ALLOW_INTERNAL_SCAN: '1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ALLOW_INTERNAL_SCAN).toBe(true);
    }
  });
});

describe('envSchema — defaults', () => {
  it('uses default PORT 3000', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it('uses default NODE_ENV "development"', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
    }
  });

  it('uses default POSTGRES_USER "whynot"', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POSTGRES_USER).toBe('whynot');
    }
  });

  it('uses default LOG_LEVEL "info"', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe('info');
    }
  });

  it('uses default RATE_LIMIT_MAX_REQUESTS 100', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_MAX_REQUESTS).toBe(100);
    }
  });

  it('uses default FRONTEND_URL', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FRONTEND_URL).toBe('http://localhost:5173');
    }
  });

  it('uses default AI_SERVICE_URL', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AI_SERVICE_URL).toBe('http://localhost:8000');
    }
  });

  it('uses default ALLOW_INTERNAL_SCAN false', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ALLOW_INTERNAL_SCAN).toBe(false);
    }
  });
});

describe('envSchema — NODE_ENV validation', () => {
  it('accepts "development"', () => {
    const result = envSchema.safeParse({ ...validEnv(), NODE_ENV: 'development' });
    expect(result.success).toBe(true);
  });

  it('accepts "production"', () => {
    const result = envSchema.safeParse({ ...validEnv(), NODE_ENV: 'production' });
    expect(result.success).toBe(true);
  });

  it('accepts "test"', () => {
    const result = envSchema.safeParse({ ...validEnv(), NODE_ENV: 'test' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validEnv(), NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });
});

describe('envSchema — LOG_LEVEL validation', () => {
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    it(`accepts "${level}"`, () => {
      const result = envSchema.safeParse({ ...validEnv(), LOG_LEVEL: level });
      expect(result.success).toBe(true);
    });
  }

  it('rejects invalid LOG_LEVEL', () => {
    const result = envSchema.safeParse({ ...validEnv(), LOG_LEVEL: 'verbose' });
    expect(result.success).toBe(false);
  });
});
