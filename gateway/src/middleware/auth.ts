import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './error-handler';
import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';

const workspaceRepository = new WorkspaceRepository();

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

// Extend Express Request to carry auth data
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      workspaceId?: string;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

/**
 * Require authenticated user. Attaches req.user and req.workspaceId.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice(7);
    let payload: any;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch (err) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.user = { id: payload.id, email: payload.email, name: payload.name, role: payload.role || 'user' };

    // Resolve workspace: use X-Workspace-ID header, fall back to user's first workspace
    const requestedWorkspaceId = req.headers['x-workspace-id'] as string | undefined;
    req.workspaceId = await resolveWorkspace(payload.id, requestedWorkspaceId);

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — populates req.user if valid token present, does not block unauthenticated requests.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.slice(7);
    try {
      const payload: any = jwt.verify(token, getJwtSecret());
      req.user = { id: payload.id, email: payload.email, name: payload.name, role: payload.role || 'user' };
    } catch {
      // silently ignore invalid token in optional mode
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Resolve which workspace to use for this request.
 * If requestedWorkspaceId is provided, validate ownership.
 * Otherwise use the user's first workspace.
 */
async function resolveWorkspace(userId: string, requestedWorkspaceId?: string): Promise<string> {
  if (requestedWorkspaceId) {
    const workspace = await workspaceRepository.findById(requestedWorkspaceId);
    if (workspace && workspace.owner_id === userId) {
      return workspace.id;
    }
    // Fall through to default if workspace not found or not owned
  }

  const workspaces = await workspaceRepository.findAllByUserId(userId);
  if (workspaces.length === 0) {
    throw createError('No workspace found for user', 500, 'NO_WORKSPACE');
  }
  return workspaces[0].id;
}
