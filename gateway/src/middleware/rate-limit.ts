import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { createError } from './error-handler';

function t(req: Request, key: string): string {
  const fn = (req as any).t;
  return fn ? fn(key) : key;
}

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.apiGeneral'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Strict rate limiter for test execution (more restrictive)
 */
const testExecutionMax = env.RATE_LIMIT_TEST_EXECUTION_MAX;
console.log(`[Rate Limit] Test execution rate limit set to: ${testExecutionMax} per hour`);

export const testExecutionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: testExecutionMax, // Limit each IP to N test executions per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.testExecution'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Rate limiter for test generation
 */
export const testGenerationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_TEST_GENERATION_MAX, // Limit each IP to 20 test generations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.testGeneration'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Strict rate limiter for QA Loop session creation.
 * Each session spawns expensive autonomous LLM loops — keep this tight.
 * Default: 5 sessions per hour per IP (override via RATE_LIMIT_QA_LOOP_MAX).
 */
export const qaLoopSessionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.RATE_LIMIT_QA_LOOP_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.qaLoopSession'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Strict rate limiter for login attempts — prevent brute-force attacks.
 * Default: 10 attempts per 15-minute window per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.login'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Rate limiter for registration — prevent mass account creation.
 * Default: 5 registrations per hour per IP.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.RATE_LIMIT_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.registration'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Rate limiter for public scan endpoints.
 * Default: 10 requests per 15-minute window per IP.
 */
export const publicEndpointRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_PUBLIC_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      t(req, 'errors:rateLimit.publicEndpoint'),
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});
