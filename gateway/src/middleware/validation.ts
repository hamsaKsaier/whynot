import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodIssue } from 'zod';
import { createError } from './error-handler';

/**
 * Spam-content guard for free-form text fields that get rendered to users
 * (e.g. `users.name` which is also written into `workspaces.name` via the
 * `${name}'s Workspace` template in seedAdminUser).
 *
 * Bots target these fields to smuggle promotional URLs and emoji-heavy
 * gambling/casino content onto your domain. Caught one wave on 2026-05-13:
 * 3 signups within 9 seconds with name = "🚀5.000 TL - Tam İade Garantili!
 * https://bit.ly/BestBonus4U 🚀".
 *
 * Designed to be PERMISSIVE on legitimate names:
 *   - Allows all Unicode letters (Arabic, Cyrillic, CJK, accents, etc.)
 *   - Allows apostrophes, hyphens, spaces, periods (O'Brien, Jean-Paul, Mr.)
 *   - Allows up to 2 emoji (lets people add a flag/heart if they want)
 *
 * Designed to be STRICT on the actual attack patterns:
 *   - Any URL-like substring (http://, https://, www., bit.ly, tinyurl, etc.)
 *   - >2 emoji (the 🚀-bombing pattern)
 *   - Gambling/promo keywords in TR/RU/EN — extend as new waves appear
 *
 * Returns true if the value is CLEAN (passes the filter). Used in zod
 * `.refine()` calls — see the `register` schema below.
 */
function isCleanFreeTextName(value: string): boolean {
  // Empty / whitespace-only handled elsewhere by .min(1)
  const v = value.trim();
  if (v.length === 0) return true;

  // 1. URL / link-shortener detection.
  //    Catches: http://, https://, www., bit.ly, tinyurl, cutt.ly, t.co, goo.gl,
  //             tiny.cc, is.gd, ow.ly, buff.ly, t.me, shorturl, rebrand.ly
  const urlPattern = /\b(https?:\/\/|www\.|bit\.ly|tinyurl|cutt\.ly|t\.co|goo\.gl|tiny\.cc|is\.gd|ow\.ly|buff\.ly|t\.me|shorturl|rebrand\.ly)\b/i;
  if (urlPattern.test(v)) return false;

  // 2. Emoji density. Allow up to 2; reject more.
  //    Uses Unicode property escape — requires ES2018+ regex support
  //    (Node 12+, which we are well past).
  const emojiMatches = v.match(/\p{Extended_Pictographic}/gu) || [];
  if (emojiMatches.length > 2) return false;

  // 3. Promo / gambling keyword blocklist. Case-insensitive substring match.
  //    Extend as new attack waves appear. Keep keywords specific enough that
  //    legitimate names don't trigger (e.g. "casino" yes, but not "cas").
  const lower = v.toLowerCase();
  const promoKeywords = [
    'bonus', 'garantili', 'i̇ade', 'iade', 'kazanc', 'kazanç',
    'casino', 'kasino', 'bahis', 'kumar', 'slot', 'bedava',
    'free spin', 'freespin', 'jackpot',
    'казино', 'бонус', 'ставк', 'выигр',
    'tl bonus', '5000 tl', '5.000 tl', '5,000 tl',
  ];
  if (promoKeywords.some(kw => lower.includes(kw))) return false;

  return true;
}

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
            { errors: issues },
            'errors:validation.failed',
            { details: errorMessages.join(', ') }
          );
        } else {
          throw createError(
            `Validation failed: ${zodError.message || 'Invalid request data'}`,
            400,
            'VALIDATION_ERROR',
            undefined,
            'errors:validation.failed',
            { details: zodError.message || 'Invalid request data' }
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
      'VALIDATION_ERROR',
      undefined,
      'errors:validation.urlFormatInvalid',
      { details: error.message }
    );
  }
}

/**
 * Text sanitization (remove potentially dangerous characters)
 */
export function sanitizeText(text: string, maxLength: number = 10000): string {
  if (!text || typeof text !== 'string') {
    throw createError('Text must be a non-empty string', 400, 'VALIDATION_ERROR', undefined, 'errors:validation.textEmpty');
  }

  if (text.length > maxLength) {
    throw createError(
      `Text exceeds maximum length of ${maxLength} characters`,
      400,
      'VALIDATION_ERROR',
      undefined,
      'errors:validation.textTooLong',
      { maxLength: String(maxLength) }
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
      .max(100, 'Name must not exceed 100 characters')
      // Reject names containing URLs, excessive emoji, or gambling keywords.
      // Error message is intentionally generic — don't tell attackers which
      // rule they hit. Legitimate users with normal names won't see this.
      .refine(isCleanFreeTextName, { message: 'Name contains disallowed content' }),
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

