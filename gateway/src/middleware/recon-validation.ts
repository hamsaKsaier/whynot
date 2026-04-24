import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createError, asyncHandler } from './error-handler';
import { query } from '../../shared/database/connection';
import { ProjectRepository, ProjectEntity } from '../../shared/database/repositories/project-repository';

export interface SavedEnvironmentEntity {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReconWarning {
  code: string;
  messageKey: string;
  message: string;
}

declare global {
  namespace Express {
    interface Request {
      reconProject?: ProjectEntity;
      reconEnvironment?: SavedEnvironmentEntity;
      reconWarnings?: ReconWarning[];
    }
  }
}

const projectRepository = new ProjectRepository();

const authorizationSchema = z.object({
  acknowledged: z.literal(true),
  justification: z.string().min(20).max(1000),
  acknowledged_by_user_id: z.string().uuid(),
  acknowledged_at: z.union([
    z.string().datetime(),
    z.date(),
  ]),
});

/**
 * Validates the `authorization` object on the create-scan request body.
 * Does NOT persist the row — the route handler writes to
 * `recon_scan_authorizations` after the scan is created (per recon-safety #1).
 */
export function validateAuthorizationPayload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const t = (req as any).t ?? ((k: string) => k);
  const body = req.body ?? {};
  const auth = body.authorization;

  if (!auth || typeof auth !== 'object') {
    throw createError(
      t('errors:recon.authorization.required'),
      400,
      'RECON_AUTHORIZATION_REQUIRED',
      undefined,
      'errors:recon.authorization.required',
    );
  }

  if (auth.acknowledged !== true) {
    throw createError(
      t('validation:recon.authorization.acknowledged'),
      400,
      'RECON_AUTHORIZATION_NOT_ACKNOWLEDGED',
      undefined,
      'validation:recon.authorization.acknowledged',
    );
  }

  const parsed = authorizationSchema.safeParse(auth);
  if (!parsed.success) {
    const hasShortJustification = parsed.error.issues.some(
      (i) => i.path.join('.') === 'justification',
    );
    if (hasShortJustification) {
      throw createError(
        t('errors:recon.authorization.justification.tooShort'),
        400,
        'RECON_AUTHORIZATION_JUSTIFICATION_TOO_SHORT',
        undefined,
        'errors:recon.authorization.justification.tooShort',
      );
    }
    throw createError(
      t('errors:recon.authorization.malformed'),
      400,
      'RECON_AUTHORIZATION_MALFORMED',
      undefined,
      'errors:recon.authorization.malformed',
    );
  }

  next();
}

/**
 * Load `projects.id = body.project_id` scoped to the caller's workspace.
 * Responds 404 (not 403) when the project exists in another workspace so we
 * never leak existence across tenants (recon-safety #8).
 */
export const loadReconProject = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw createError(
        'Workspace not resolved',
        401,
        'WORKSPACE_NOT_RESOLVED',
        undefined,
        'errors:workspace.notResolved',
      );
    }
    const projectId = (req.body?.project_id ?? '') as string;
    if (!projectId) {
      throw createError(
        'project_id is required',
        400,
        'VALIDATION_ERROR',
        undefined,
        'errors:resource.projectNotFound',
      );
    }
    const project = await projectRepository.findByIdForWorkspace(projectId, workspaceId);
    if (!project) {
      throw createError(
        'Project not found',
        404,
        'PROJECT_NOT_FOUND',
        undefined,
        'errors:resource.projectNotFound',
      );
    }
    req.reconProject = project;
    next();
  },
);

/**
 * Load `saved_environments.id = body.environment_id` scoped to the caller's
 * workspace. 404 on missing / cross-workspace.
 */
export const loadReconEnvironment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw createError(
        'Workspace not resolved',
        401,
        'WORKSPACE_NOT_RESOLVED',
        undefined,
        'errors:workspace.notResolved',
      );
    }
    const environmentId = (req.body?.environment_id ?? '') as string;
    if (!environmentId) {
      throw createError(
        'environment_id is required',
        400,
        'VALIDATION_ERROR',
        undefined,
        'errors:resource.environmentNotFound',
      );
    }
    const rows = await query<SavedEnvironmentEntity>(
      'SELECT * FROM saved_environments WHERE id = $1 AND workspace_id = $2',
      [environmentId, workspaceId],
    );
    const env = rows[0];
    if (!env) {
      throw createError(
        'Environment not found',
        404,
        'ENVIRONMENT_NOT_FOUND',
        undefined,
        'errors:resource.environmentNotFound',
      );
    }
    req.reconEnvironment = env;
    next();
  },
);

/**
 * Requires that the workspace has at least one linked GitHub repository.
 * Per the task spec (D3): a project-linked repo is required before a scan.
 * The `github_repos` table is workspace-scoped, so we check workspace-level
 * linkage rather than per-project.
 */
export const validateProjectHasGitHubRepo = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = req.workspaceId;
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM github_repos WHERE workspace_id = $1`,
      [workspaceId],
    );
    const count = parseInt(rows[0]?.count ?? '0', 10);
    if (count === 0) {
      throw createError(
        'Project must have a linked GitHub repository',
        400,
        'RECON_PROJECT_REPO_REQUIRED',
        undefined,
        'errors:recon.project.repoRequired',
      );
    }
    next();
  },
);

/**
 * Requires that the loaded environment has a non-empty URL. Must run AFTER
 * `loadReconEnvironment`.
 */
export function validateEnvironmentHasUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const env = req.reconEnvironment;
  const url = env?.url?.trim() ?? '';
  if (!url) {
    throw createError(
      'Environment must have a URL configured',
      400,
      'RECON_ENVIRONMENT_URL_REQUIRED',
      undefined,
      'errors:recon.environment.urlRequired',
    );
  }
  next();
}

/**
 * Attaches a production-environment warning to `req.reconWarnings` when the
 * selected environment looks like production. Never blocks the request —
 * v1 uses authorization-only scanning (recon-safety #9).
 *
 * Since `saved_environments` has no `type` column, we heuristically match on
 * the environment's name: any name containing "prod" (case-insensitive) is
 * treated as production.
 */
export function productionEnvironmentWarning(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const env = req.reconEnvironment;
  if (!env) {
    next();
    return;
  }
  const name = env.name.toLowerCase();
  const looksProduction = /\bprod(uction)?\b/.test(name) || /prod/.test(name);
  if (looksProduction) {
    const t = (req as any).t ?? ((k: string) => k);
    const warnings = req.reconWarnings ?? (req.reconWarnings = []);
    warnings.push({
      code: 'recon.environment.production',
      messageKey: 'errors:recon.warnings.environmentProduction',
      message: t('errors:recon.warnings.environmentProduction'),
    });
  }
  next();
}

/**
 * Rejects a resume request whose target URL does not byte-for-byte match the
 * original scan's target URL (recon-safety #5).
 */
export function resumeUrlGuard(
  originalUrl: string,
  incomingUrl: string,
  req: Request,
): void {
  if (originalUrl !== incomingUrl) {
    throw createError(
      'Resume request rejected: target URL does not match',
      400,
      'RECON_RESUME_URL_MISMATCH',
      undefined,
      'errors:recon.resume.urlMismatch',
    );
  }
}
