import { Router, Request, Response } from 'express'
import { query } from '../../shared/database/connection'
import { createLogger } from '../../shared/logger/logger'
import { createError, asyncHandler } from '../middleware/error-handler'
import rateLimit from 'express-rate-limit'
import { PLANS, DEFAULT_PAYG_RATES, DEFAULT_TRIAL_DAYS } from '../../shared/constants/pricing'
import { env } from '../config/env'

const logger = createLogger('landing-leads')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const leadCaptureRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_LEAD_CAPTURE_MAX,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    throw createError(
      (req as any).t('errors:rateLimit.leadCapture'),
      429,
      'RATE_LIMIT_EXCEEDED'
    )
  },
})

export const landingLeadsRouter = Router()

landingLeadsRouter.get('/pricing', asyncHandler(async (_req: Request, res: Response) => {
  let trialDays = DEFAULT_TRIAL_DAYS
  let paygOverrides: Record<string, number> | null = null

  try {
    const configResult = await query(
      `SELECT key, value FROM billing_config WHERE key IN ('trial_days', 'payg_rates')`
    )
    for (const row of configResult) {
      if (row.key === 'trial_days') trialDays = parseInt(row.value, 10) || DEFAULT_TRIAL_DAYS
      if (row.key === 'payg_rates') paygOverrides = JSON.parse(row.value)
    }
  } catch {
    logger.debug('billing_config not available, using defaults')
  }

  const plans = Object.entries(PLANS).map(([slug, plan]) => ({
    slug,
    name: plan.name,
    monthlyCents: Number(plan.monthlyCents),
    tier: plan.tier,
  }))

  const paygRates = Object.entries(DEFAULT_PAYG_RATES).map(([event, credits]) => ({
    event,
    credits: paygOverrides?.[event] ?? Number(credits),
  }))

  res.set('Cache-Control', 'public, max-age=300')
  res.json({ plans, paygRates, currency: 'usd', trialDays })
}))

landingLeadsRouter.post('/leads', leadCaptureRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, source, metadata } = req.body

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw createError((req as any).t('errors:validation.emailInvalid'), 400, 'INVALID_EMAIL')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const locale = req.headers['accept-language']?.split(',')[0]?.trim() || 'en'
  const safeSource = typeof source === 'string' ? source.slice(0, 100) : 'landing'
  const safeMetadata = typeof metadata === 'object' && metadata !== null ? metadata : {}

  try {
    await query(
      `INSERT INTO landing_leads (email, source, locale, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(email)) DO NOTHING`,
      [normalizedEmail, safeSource, locale.slice(0, 10), JSON.stringify(safeMetadata)]
    )

    logger.info('Landing lead captured', { email: normalizedEmail, source: safeSource })
    res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Failed to capture landing lead', error)
    throw createError((req as any).t('errors:service.leadSaveFailed'), 500, 'INTERNAL_ERROR')
  }
}))
