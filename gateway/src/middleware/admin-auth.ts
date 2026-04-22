import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../../shared/database/repositories/user-repository';

const userRepository = new UserRepository();

/**
 * Require admin or super_admin role. Must be applied after requireAuth.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const t = (req as any).t ?? ((k: string) => k);
    if (!req.user) {
      res.status(401).json({ success: false, error: t('errors:auth.unauthorized') });
      return;
    }

    const user = await userRepository.findById(req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      res.status(403).json({ success: false, error: t('errors:auth.adminRequired') });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require super_admin role. Must be applied after requireAuth.
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const t = (req as any).t ?? ((k: string) => k);
    if (!req.user) {
      res.status(401).json({ success: false, error: t('errors:auth.unauthorized') });
      return;
    }

    const user = await userRepository.findById(req.user.id);
    if (!user || user.role !== 'super_admin') {
      res.status(403).json({ success: false, error: t('errors:auth.superAdminRequired') });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
