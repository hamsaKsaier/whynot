import type { Request, Response, NextFunction } from 'express';
import { type PlatformFeatureKey } from '../../../shared/constants/platform-features';
import { isFlagEnabled } from '../utils/feature-flags';

export function requireFlag(key: PlatformFeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.workspaceId;
      if (!orgId) {
        res.status(401).json({ success: false, error: 'Workspace not resolved' });
        return;
      }

      if (!(await isFlagEnabled(orgId, key))) {
        const t = (req as any).t;
        res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: t ? t('errors:flags.disabled') : 'This feature is currently disabled',
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
