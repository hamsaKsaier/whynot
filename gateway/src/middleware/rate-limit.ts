import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { createError } from './error-handler';

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    throw createError(
      'Too many requests from this IP, please try again later.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

/**
 * Strict rate limiter for test execution (more restrictive)
 */
const testExecutionMax = parseInt(process.env.RATE_LIMIT_TEST_EXECUTION_MAX || '10', 10);
console.log(`[Rate Limit] Test execution rate limit set to: ${testExecutionMax} per hour`);

export const testExecutionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: testExecutionMax, // Limit each IP to N test executions per hour
  message: 'Too many test executions from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      'Too many test executions from this IP. Please wait before running more tests.',
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
  max: parseInt(process.env.RATE_LIMIT_TEST_GENERATION_MAX || '20', 10), // Limit each IP to 20 test generations per 15 minutes
  message: 'Too many test generation requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      'Too many test generation requests from this IP, please try again later.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});











