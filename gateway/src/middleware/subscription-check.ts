import { Request, Response, NextFunction } from 'express';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { isSelfHosted } from '../config/edition';

const subscriptionRepository = new SubscriptionRepository();

/**
 * Middleware that checks if the workspace has an active or trialing subscription.
 * Returns 403 if no active subscription exists.
 */
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Self-hosted edition has no billing — every workspace is fully entitled.
  if (isSelfHosted()) return next();
  try {
    const t = (req as any).t ?? ((k: string) => k);
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: t('errors:workspace.notResolved') });
      return;
    }

    const subscription = await subscriptionRepository.findByWorkspaceId(workspaceId);

    if (!subscription) {
      res.status(403).json({
        success: false,
        error: t('errors:subscription.notActive'),
        code: 'NO_SUBSCRIPTION',
        details: {
          upgrade_url: '/billing',
        },
      });
      return;
    }

    const activeStatuses = ['active', 'trialing'];
    if (!activeStatuses.includes(subscription.status)) {
      res.status(403).json({
        success: false,
        error: t('errors:subscription.inactive'),
        code: 'SUBSCRIPTION_INACTIVE',
        details: {
          status: subscription.status,
          upgrade_url: '/billing',
        },
      });
      return;
    }

    // Check if trial has expired
    if (subscription.status === 'trialing' && subscription.trial_end) {
      const trialEnd = new Date(subscription.trial_end);
      if (trialEnd < new Date()) {
        res.status(403).json({
          success: false,
          error: t('errors:subscription.trialExpired'),
          code: 'TRIAL_EXPIRED',
          details: {
            trial_end: trialEnd.toISOString(),
            upgrade_url: '/billing',
          },
        });
        return;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
