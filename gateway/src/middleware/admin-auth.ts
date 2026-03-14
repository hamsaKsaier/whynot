import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../../shared/database/repositories/user-repository';

const userRepository = new UserRepository();

/**
 * Require admin or super_admin role. Must be applied after requireAuth.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const user = await userRepository.findById(req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      res.status(403).json({ success: false, error: 'Admin access required' });
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
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const user = await userRepository.findById(req.user.id);
    if (!user || user.role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Super admin access required' });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
