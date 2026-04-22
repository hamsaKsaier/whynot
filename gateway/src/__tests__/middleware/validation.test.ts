import { describe, it, expect, vi } from 'vitest';
import { validate, sanitizeUrl, sanitizeText, schemas } from '../../middleware/validation';
import { z } from 'zod';

function makeMocks(body: any = {}) {
  const req = { body, headers: {}, t: vi.fn((k: string) => k) } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('validate', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  it('calls next() when body is valid', () => {
    const { req, res, next } = makeMocks({ name: 'Alice', age: 30 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('throws createError with 400 for invalid body', () => {
    const { req, res, next } = makeMocks({ name: '', age: -1 });
    expect(() => validate(schema)(req, res, next)).toThrow(/Validation failed/);
  });

  it('includes path info in validation message', () => {
    const { req, res, next } = makeMocks({ name: 'ok', age: 'not-a-number' });
    try {
      validate(schema)(req, res, next);
    } catch (err: any) {
      expect(err.message).toContain('age');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    }
  });

  it('re-throws non-ZodError errors', () => {
    // Use a schema that throws a non-Zod error on parse
    const badSchema = {
      parse: () => {
        throw new Error('unexpected');
      },
    } as any;
    const { req, res, next } = makeMocks({});
    expect(() => validate(badSchema)(req, res, next)).toThrow('unexpected');
  });
});

describe('sanitizeUrl', () => {
  it('accepts valid http url', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('accepts valid https url', () => {
    expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('rejects javascript: protocol', () => {
    expect(() => sanitizeUrl('javascript:alert(1)')).toThrow(/Invalid/);
  });

  it('rejects ftp: protocol', () => {
    expect(() => sanitizeUrl('ftp://files.example.com')).toThrow(/Invalid protocol/);
  });

  it('rejects completely invalid url', () => {
    expect(() => sanitizeUrl('not a url')).toThrow(/Invalid URL format/);
  });

  it('throws with status 400 and VALIDATION_ERROR code', () => {
    try {
      sanitizeUrl('ftp://x.com');
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('sanitizeText', () => {
  it('returns text with control chars removed', () => {
    const input = 'hello\x00world\x08!';
    expect(sanitizeText(input)).toBe('helloworld!');
  });

  it('preserves newlines and tabs', () => {
    const input = 'line1\nline2\ttab';
    expect(sanitizeText(input)).toBe('line1\nline2\ttab');
  });

  it('throws for empty string', () => {
    expect(() => sanitizeText('')).toThrow('Text must be a non-empty string');
  });

  it('throws for non-string input', () => {
    expect(() => sanitizeText(null as any)).toThrow('Text must be a non-empty string');
  });

  it('throws for text exceeding maxLength', () => {
    const longText = 'a'.repeat(101);
    expect(() => sanitizeText(longText, 100)).toThrow(/exceeds maximum length/);
  });

  it('uses default maxLength of 10000', () => {
    const text = 'a'.repeat(10000);
    expect(sanitizeText(text)).toBe(text); // should not throw
  });

  it('throws when exceeding default maxLength', () => {
    const text = 'a'.repeat(10001);
    expect(() => sanitizeText(text)).toThrow(/exceeds maximum length of 10000/);
  });
});

describe('schemas', () => {
  describe('register', () => {
    it('accepts valid registration', () => {
      const result = schemas.register.safeParse({
        email: 'user@test.com',
        password: 'password123',
        name: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = schemas.register.safeParse({
        email: 'not-email',
        password: 'password123',
        name: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = schemas.register.safeParse({
        email: 'user@test.com',
        password: 'short',
        name: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing name', () => {
      const result = schemas.register.safeParse({
        email: 'user@test.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('login', () => {
    it('accepts valid login', () => {
      const result = schemas.login.safeParse({
        email: 'user@test.com',
        password: 'pass',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = schemas.login.safeParse({
        email: 'user@test.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('runTest', () => {
    it('accepts valid test params', () => {
      const result = schemas.runTest.safeParse({
        website_url: 'https://example.com',
        user_story: 'As a user I want to login so that I can access my account',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-http url', () => {
      const result = schemas.runTest.safeParse({
        website_url: 'ftp://example.com',
        user_story: 'As a user I want something',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short user story', () => {
      const result = schemas.runTest.safeParse({
        website_url: 'https://example.com',
        user_story: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createPlan', () => {
    it('accepts valid plan', () => {
      const result = schemas.createPlan.safeParse({
        name: 'Pro',
        slug: 'pro-monthly',
        price_cents: 2999,
        credits_per_period: 100,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid slug format', () => {
      const result = schemas.createPlan.safeParse({
        name: 'Pro',
        slug: 'Pro Monthly!',
        price_cents: 2999,
        credits_per_period: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('grantCredits', () => {
    it('requires amount >= 1', () => {
      const result = schemas.grantCredits.safeParse({
        amount: 0,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid grant', () => {
      const result = schemas.grantCredits.safeParse({
        amount: 50,
        description: 'Bonus credits',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createProject', () => {
    it('accepts valid project', () => {
      const result = schemas.createProject.safeParse({
        name: 'My Project',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = schemas.createProject.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
