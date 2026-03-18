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
    additional_context: z.string().max(2000, 'Additional context must not exceed 2000 characters').optional(),
    prerequisite_steps: z.array(
      z.object({
        action: z.enum(['click', 'type']),
        selector: z.string().min(1),
        value: z.string().optional()
      })
    ).optional(),
    project_id: z.string().uuid().optional(),
    user_story_id: z.string().uuid().optional(),
    quick_mode: z.boolean().optional()
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
  }),

  // ─── Admin: Plan Management ──────────────────────────────────────────────

  createPlan: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().max(500).optional(),
    price_cents: z.number().int().min(0),
    billing_interval: z.enum(['monthly', 'yearly', 'one_time']).optional(),
    credits_per_period: z.number().int().min(0),
    trial_days: z.number().int().min(0).optional(),
    is_custom: z.boolean().optional(),
    is_public: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),

  updatePlan: z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
    description: z.string().max(500).optional(),
    price_cents: z.number().int().min(0).optional(),
    billing_interval: z.enum(['monthly', 'yearly', 'one_time']).optional(),
    credits_per_period: z.number().int().min(0).optional(),
    trial_days: z.number().int().min(0).optional(),
    is_custom: z.boolean().optional(),
    is_public: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),

  setPlanFeatures: z.object({
    features: z.record(z.string(), z.string()),
  }),

  grantCredits: z.object({
    amount: z.number().int().min(1, 'Amount must be at least 1'),
    description: z.string().min(1).max(500),
  }),

  revokeCredits: z.object({
    amount: z.number().int().min(1, 'Amount must be at least 1'),
    description: z.string().min(1).max(500),
  }),

  adminUpdateSubscription: z.object({
    plan_id: z.string().uuid().optional(),
    status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'paused', 'incomplete']).optional(),
  }),

  // ─── Auth Schemas ──────────────────────────────────────────────────────────

  register: z.object({
    email: z.string().email('Invalid email address').max(255),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters'),
    name: z.string()
      .min(1, 'Name is required')
      .max(100, 'Name must not exceed 100 characters'),
  }),

  login: z.object({
    email: z.string().email('Invalid email address').max(255),
    password: z.string().min(1, 'Password is required').max(128),
  }),

  // ─── Project / Workspace Schemas ──────────────────────────────────────────

  createProject: z.object({
    name: z.string()
      .min(1, 'Project name is required')
      .max(255, 'Project name must not exceed 255 characters'),
    description: z.string().max(2000, 'Description must not exceed 2000 characters').optional(),
    website_url: z.string().url('Must be a valid URL').optional(),
  }),

  createWorkspace: z.object({
    name: z.string()
      .min(1, 'Workspace name is required')
      .max(255, 'Workspace name must not exceed 255 characters'),
  }),

  createUserStory: z.object({
    story: z.string()
      .min(1, 'User story text is required')
      .max(10000, 'User story must not exceed 10000 characters'),
    website_url: z.string().url('Must be a valid URL').optional(),
    additional_context: z.string().max(5000, 'Additional context must not exceed 5000 characters').optional(),
  }),
};

