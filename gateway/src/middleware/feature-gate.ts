import { Request, Response, NextFunction } from 'express';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { isSelfHosted } from '../config/edition';

const subscriptionRepository = new SubscriptionRepository();
const planRepository = new PlanRepository();

/**
 * Cache plan features for a short duration to avoid hitting DB on every request.
 */
const featureCache = new Map<string, { features: Record<string, string>; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

async function getWorkspaceFeatures(workspaceId: string): Promise<Record<string, string>> {
  const cached = featureCache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.features;
  }

  const subscription = await subscriptionRepository.findByWorkspaceId(workspaceId);
  if (!subscription) return {};

  const featureEntities = await planRepository.getFeatures(subscription.plan_id);
  const features: Record<string, string> = {};
  for (const f of featureEntities) {
    features[f.feature_key] = f.feature_value;
  }

  featureCache.set(workspaceId, { features, expiresAt: Date.now() + CACHE_TTL_MS });
  return features;
}

/**
 * Middleware that checks if the workspace's plan includes a specific feature.
 * Returns 403 if the feature is not available.
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Self-hosted edition unlocks every feature — no plan tiers.
    if (isSelfHosted()) return next();
    try {
      const t = (req as any).t ?? ((k: string) => k);
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: t('errors:workspace.notResolved') });
        return;
      }

      const features = await getWorkspaceFeatures(workspaceId);
      const value = features[featureKey];

      // Feature must exist and not be 'false' or '0'
      if (!value || value === 'false' || value === '0') {
        res.status(403).json({
          success: false,
          error: t('errors:feature.notAvailable'),
          code: 'FEATURE_NOT_AVAILABLE',
          details: {
            feature: featureKey,
            upgrade_url: '/billing',
          },
        });
        return;
      }

      // Attach features to request for downstream use
      (req as any)._planFeatures = features;

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware that checks a numeric feature limit (e.g., max_projects).
 * countFn receives the request and returns the current count.
 */
export function requireFeatureLimit(
  featureKey: string,
  countFn: (req: Request) => Promise<number>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Self-hosted edition has no plan limits.
    if (isSelfHosted()) return next();
    try {
      const t = (req as any).t ?? ((k: string) => k);
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: t('errors:workspace.notResolved') });
        return;
      }

      const features = await getWorkspaceFeatures(workspaceId);
      const limitStr = features[featureKey];

      // If 'unlimited' or not set, allow (enterprise plans)
      if (!limitStr || limitStr === 'unlimited') {
        next();
        return;
      }

      const limit = parseInt(limitStr, 10);
      if (isNaN(limit)) {
        next();
        return;
      }

      const currentCount = await countFn(req);
      if (currentCount >= limit) {
        res.status(403).json({
          success: false,
          error: t('errors:feature.limitReached', { limit }),
          code: 'FEATURE_LIMIT_REACHED',
          details: {
            feature: featureKey,
            limit,
            current: currentCount,
            upgrade_url: '/billing',
          },
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
