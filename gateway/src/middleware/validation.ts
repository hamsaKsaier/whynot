import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodIssue } from 'zod';
import { createError } from './error-handler';

/**
 * Validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const zodError = error;
        // ZodError uses 'issues' property, not 'errors'
        const issues = zodError.issues || [];
        if (issues.length > 0) {
          const errorMessages = issues.map((issue: ZodIssue) => {
            const path = Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || '');
            return `${path}: ${issue.message || 'Validation error'}`;
          });
          
          throw createError(
            `Validation failed: ${errorMessages.join(', ')}`,
            400,
            'VALIDATION_ERROR',
            { errors: issues }
          );
        } else {
          throw createError(
            `Validation failed: ${zodError.message || 'Invalid request data'}`,
            400,
            'VALIDATION_ERROR'
          );
        }
      }
      throw error;
    }
  };
}

/**
 * URL sanitization
 */
export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove dangerous protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid protocol. Only http and https are allowed.');
    }
    return urlObj.toString();
  } catch (error: any) {
    throw createError(
      `Invalid URL format: ${error.message}`,
      400,
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Text sanitization (remove potentially dangerous characters)
 */
export function sanitizeText(text: string, maxLength: number = 10000): string {
  if (!text || typeof text !== 'string') {
    throw createError('Text must be a non-empty string', 400, 'VALIDATION_ERROR');
  }
  
  if (text.length > maxLength) {
    throw createError(
      `Text exceeds maximum length of ${maxLength} characters`,
      400,
      'VALIDATION_ERROR'
    );
  }
  
  // Remove null bytes and other control characters (except newlines and tabs)
  return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validation schemas
 */
export const schemas = {
  runTest: z.object({
    website_url: z.string()
      .url('Invalid URL format')
      .refine((url) => {
        try {
          const urlObj = new URL(url);
          return ['http:', 'https:'].includes(urlObj.protocol);
        } catch {
          return false;
        }
      }, 'URL must use http or https protocol'),
    user_story: z.string()
      .min(10, 'User story must be at least 10 characters')
      .max(5000, 'User story must not exceed 5000 characters'),
    headless: z.boolean().optional().default(false),
    additional_context: z.string().max(2000, 'Additional context must not exceed 2000 characters').optional()
  }),

  generateTests: z.object({
    website_url: z.string()
      .url('Invalid URL format')
      .refine((url) => {
        try {
          const urlObj = new URL(url);
          return ['http:', 'https:'].includes(urlObj.protocol);
        } catch {
          return false;
        }
      }, 'URL must use http or https protocol'),
    user_story: z.string()
      .min(10, 'User story must be at least 10 characters')
      .max(5000, 'User story must not exceed 5000 characters'),
    additional_context: z.string().max(2000, 'Additional context must not exceed 2000 characters').optional()
  }),

  executeTest: z.object({
    id: z.string().min(1, 'Test case ID is required'),
    name: z.string().min(1, 'Test case name is required'),
    website_url: z.string().url('Invalid URL format'),
    steps: z.array(
      z.object({
        id: z.string().optional().nullable(),
        action: z.string(),
        description: z.string().optional().nullable(),
        target: z.any().optional().nullable(),
        value: z.union([z.string(), z.null()]).optional().nullable(),
        wait_time: z.union([z.number(), z.null()]).optional().nullable(),
        expected_outcome: z.string().optional().nullable()
      })
    ).min(1, 'Test case must have at least one step'),
    metadata: z.any().optional().nullable()
  })
};

