import type { Request, Response, NextFunction } from 'express';
import { type PlatformFeatureKey } from '../../shared/constants/platform-features';
import { isFlagEnabled } from '../utils/feature-flags';

export interface RequireFlagOptions {
  statusCode?: number;
}

export function requireFlag(key: PlatformFeatureKey, options: RequireFlagOptions = {}) {
  const statusCode = options.statusCode ?? 403;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const t = (req as any).t ?? ((k: string) => k);
      const orgId = req.workspaceId;
      if (!orgId) {
        res.status(401).json({ success: false, error: t('errors:workspace.notResolved') });
        return;
      }

      if (!(await isFlagEnabled(orgId, key))) {
        res.status(statusCode).json({
          success: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: t('errors:flags.disabled'),
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
