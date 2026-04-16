/**
 * Centralized environment configuration for the gateway.
 *
 * Every process.env read in gateway/ MUST go through this module.
 * The schema is validated at import time — if a required var is missing
 * the process exits with a clear error listing every problem.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Coerce a string env var to a number. */
const numericString = z.coerce.number();

/** Coerce a string env var to a boolean (accepts "true"/"false"/"1"/"0"). */
const booleanString = z
  .string()
  .default('false')
  .transform((v) => v === 'true' || v === '1');

// ── Schema ───────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Server ──────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: numericString.default(3000),

  // ── Database ────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().optional(),
  POSTGRES_USER: z.string().default('whynot'),
  POSTGRES_PASSWORD: z.string().default('whynot'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: numericString.default(5432),
  POSTGRES_DB: z.string().default('whynot'),

  // ── Authentication ──────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_CALLBACK_URL: z
    .string()
    .default('http://localhost:3010/api/auth/github/callback'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z
    .string()
    .default('http://localhost:3010/api/auth/google/callback'),

  // ── Encryption ──────────────────────────────────────────────────────────
  SECRETS_ENCRYPTION_KEY: z.string().default(''),
  ENCRYPTION_KEY: z.string().default(''),

  // ── Stripe ──────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_SUCCESS_URL: z
    .string()
    .default('http://localhost:5183/billing?success=true'),
  STRIPE_CANCEL_URL: z
    .string()
    .default('http://localhost:5183/billing?canceled=true'),

  // Stripe price IDs
  STRIPE_PRICE_STARTER_MONTHLY: z.string().default(''),
  STRIPE_PRICE_STARTER_YEARLY: z.string().default(''),
  STRIPE_PRICE_PRO_MONTHLY: z.string().default(''),
  STRIPE_PRICE_PRO_YEARLY: z.string().default(''),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().default(''),
  STRIPE_PRICE_BUSINESS_YEARLY: z.string().default(''),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().default(''),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().default(''),
  STRIPE_PRICE_PAYG_METERED: z.string().default(''),

  // ── AI Providers ────────────────────────────────────────────────────────
  LLM_PROVIDER: z.string().default('anthropic'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_VISION_MODEL: z.string().default('gpt-4o'),

  // ── Email ───────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM_ADDRESS: z
    .string()
    .default('WhyNot <notifications@whynot.qa>'),

  // ── Rate Limits ─────────────────────────────────────────────────────────
  RATE_LIMIT_MAX_REQUESTS: numericString.default(100),
  RATE_LIMIT_TEST_EXECUTION_MAX: numericString.default(10),
  RATE_LIMIT_TEST_GENERATION_MAX: numericString.default(20),
  RATE_LIMIT_QA_LOOP_MAX: numericString.default(5),
  RATE_LIMIT_LOGIN_MAX: numericString.default(10),
  RATE_LIMIT_REGISTER_MAX: numericString.default(5),
  RATE_LIMIT_PUBLIC_MAX: numericString.default(10),
  RATE_LIMIT_LEAD_CAPTURE_MAX: numericString.default(10),

  // ── URLs ────────────────────────────────────────────────────────────────
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ADMIN_FRONTEND_URL: z.string().default('http://localhost:5184'),
  SUPERADMIN_FRONTEND_URL: z.string().default('http://localhost:5184'),
  // ── Admin Seed ──────────────────────────────────────────────────────────
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().default('Admin'),

  CORS_ALLOWED_ORIGINS: z.string().default(''),
  GATEWAY_URL: z.string().default('http://localhost:3010'),
  APP_URL: z.string().default(''),
  API_BASE_URL: z.string().default('http://localhost:3001'),

  // Internal service URLs
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  TEST_EXECUTOR_URL: z.string().default('http://localhost:3001'),
  QA_LOOP_EXECUTOR_URL: z.string().default('http://localhost:3002'),

  // ── File Storage & Cleanup ──────────────────────────────────────────────
  SCREENSHOT_RETENTION_DAYS: numericString.default(30),
  SCREENSHOTS_DIR: z.string().default(''),
  VISUAL_DIFFS_DIR: z.string().default(''),
  VIDEO_DIR: z.string().default('/tmp/videos'),

  // ── Workflow ─────────────────────────────────────────────────────────────
  PAGE_CAPTURE_TIMEOUT_MS: numericString.default(60000),
  PAGE_CAPTURE_MAX_RETRIES: numericString.default(2),

  // ── Security ─────────────────────────────────────────────────────────────
  ALLOW_INTERNAL_SCAN: booleanString,

  // ── Observability ────────────────────────────────────────────────────────
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

// ── Parse & validate ─────────────────────────────────────────────────────────

/** Exported for testing — validate env vars against this schema. */
export { envSchema };

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      `\n❌  Environment validation failed:\n${formatted}\n\nCheck your .env file against .env.example.\n`
    );
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated, typed configuration object.
 * Import this instead of reading process.env directly.
 */
export const env: Env = loadEnv();

/**
 * Computed database connection string.
 * Prefers DATABASE_URL if set, otherwise constructs from individual POSTGRES_* vars.
 */
export function getDatabaseUrl(): string {
  return (
    env.DATABASE_URL ||
    `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`
  );
}
