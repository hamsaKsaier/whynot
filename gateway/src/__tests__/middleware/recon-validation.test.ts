/**
 * Direct unit tests for the recon-validation middlewares.
 *
 * The router-integration tests exercise the happy paths, but several
 * defensive branches are only reachable when the middleware is invoked
 * outside its normal chain (e.g., missing workspaceId even though requireAuth
 * populates it in the router). These tests close those coverage gaps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../../shared/database/connection', () => ({ query: vi.fn() }));
vi.mock('../../../shared/database/repositories/project-repository', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => ({
    findByIdForWorkspace: vi.fn(),
  })),
}));

import { query } from '../../../shared/database/connection';
import { ProjectRepository } from '../../../shared/database/repositories/project-repository';
import {
  validateAuthorizationPayload,
  loadReconProject,
  loadReconEnvironment,
  validateEnvironmentHasUrl,
  productionEnvironmentWarning,
  resumeUrlGuard,
} from '../../middleware/recon-validation';

const mockQuery = query as ReturnType<typeof vi.fn>;

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    params: {},
    query: {},
    t: (k: string) => k,
    ...overrides,
  } as unknown as Request;
}

const fakeRes = {} as Response;

function runMw(
  mw: (req: Request, res: Response, next: NextFunction) => any,
  req: Request,
): Promise<{ error?: unknown; called: boolean }> {
  return new Promise((resolve) => {
    const next = (err?: unknown) => {
      resolve({ error: err, called: true });
    };
    try {
      const ret = mw(req, fakeRes, next as NextFunction);
      if (ret && typeof (ret as Promise<unknown>).then === 'function') {
        (ret as Promise<unknown>).then(
          () => resolve({ called: true }),
          (e) => resolve({ error: e, called: true }),
        );
      }
    } catch (e) {
      resolve({ error: e, called: true });
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateAuthorizationPayload — defensive branches', () => {
  it('throws recon.authorization.required when body is empty', () => {
    const req = fakeReq({ body: {} });
    let thrown: any;
    try { validateAuthorizationPayload(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.authorization.required');
  });

  it('throws recon.authorization.required when authorization is a primitive', () => {
    const req = fakeReq({ body: { authorization: 'not-an-object' } });
    let thrown: any;
    try { validateAuthorizationPayload(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.authorization.required');
  });

  it('throws recon.authorization.required when authorization is null', () => {
    const req = fakeReq({ body: { authorization: null } });
    let thrown: any;
    try { validateAuthorizationPayload(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.authorization.required');
  });

  it('throws when body is undefined (body ?? {} fallback)', () => {
    const req = fakeReq({ body: undefined as any });
    let thrown: any;
    try { validateAuthorizationPayload(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.authorization.required');
  });

  it('falls back to identity t() when req.t is not set', () => {
    const req = { body: {}, headers: {}, params: {}, query: {} } as unknown as Request;
    let thrown: any;
    try { validateAuthorizationPayload(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.authorization.required');
  });
});

describe('loadReconProject — defensive branches', () => {
  it('throws WORKSPACE_NOT_RESOLVED when req.workspaceId is missing', async () => {
    const req = fakeReq({ body: { project_id: 'p-1' } });
    const { error } = await runMw(loadReconProject, req);
    expect((error as any).code).toBe('WORKSPACE_NOT_RESOLVED');
    expect((error as any).statusCode).toBe(401);
  });

  it('throws VALIDATION_ERROR when project_id is missing', async () => {
    const req = fakeReq({ workspaceId: 'ws-1', body: {} } as any);
    const { error } = await runMw(loadReconProject, req);
    expect((error as any).code).toBe('VALIDATION_ERROR');
    expect((error as any).statusCode).toBe(400);
  });

  it('throws PROJECT_NOT_FOUND when repo returns null', async () => {
    const instance = new ProjectRepository() as any;
    instance.findByIdForWorkspace.mockResolvedValue(null);
    const mockedCtor = ProjectRepository as unknown as ReturnType<typeof vi.fn>;
    // The module-level `projectRepository` was constructed at import time,
    // so the mock on this new instance isn't the one actually used. Force
    // the module's instance mock via the first constructor return value.
    const firstInstance = mockedCtor.mock.results[0]?.value;
    if (firstInstance) {
      firstInstance.findByIdForWorkspace.mockResolvedValue(null);
    }

    const req = fakeReq({ workspaceId: 'ws-1', body: { project_id: 'p-1' } } as any);
    const { error } = await runMw(loadReconProject, req);
    expect((error as any).code).toBe('PROJECT_NOT_FOUND');
    expect((error as any).statusCode).toBe(404);
  });

  // The happy-path (repo returns a row → req.reconProject is set) is already
  // exercised by the recon-router integration tests; we don't duplicate it
  // here because the module-level repo instance is constructed at import time
  // and isn't easily reset per-test.
});

describe('loadReconEnvironment — defensive branches', () => {
  it('throws WORKSPACE_NOT_RESOLVED when req.workspaceId is missing', async () => {
    const req = fakeReq({ body: { environment_id: 'e-1' } });
    const { error } = await runMw(loadReconEnvironment, req);
    expect((error as any).code).toBe('WORKSPACE_NOT_RESOLVED');
  });

  it('throws VALIDATION_ERROR when environment_id is missing', async () => {
    const req = fakeReq({ workspaceId: 'ws-1', body: {} } as any);
    const { error } = await runMw(loadReconEnvironment, req);
    expect((error as any).code).toBe('VALIDATION_ERROR');
  });

  it('throws ENVIRONMENT_NOT_FOUND when DB returns no rows', async () => {
    mockQuery.mockResolvedValue([]);
    const req = fakeReq({
      workspaceId: 'ws-1',
      body: { environment_id: 'e-missing' },
    } as any);
    const { error } = await runMw(loadReconEnvironment, req);
    expect((error as any).code).toBe('ENVIRONMENT_NOT_FOUND');
    expect((error as any).statusCode).toBe(404);
  });

  it('attaches env and calls next when DB returns a row', async () => {
    const env = {
      id: 'e-1',
      workspace_id: 'ws-1',
      name: 'Staging',
      url: 'https://x',
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValue([env]);
    const req = fakeReq({ workspaceId: 'ws-1', body: { environment_id: 'e-1' } } as any);
    const { error } = await runMw(loadReconEnvironment, req);
    expect(error).toBeUndefined();
    expect(req.reconEnvironment).toEqual(env);
  });
});

describe('validateEnvironmentHasUrl', () => {
  it('throws when env has no url', () => {
    const req = fakeReq({
      reconEnvironment: { url: '' } as any,
    });
    let thrown: any;
    try { validateEnvironmentHasUrl(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.environment.urlRequired');
  });

  it('throws when env url is whitespace-only', () => {
    const req = fakeReq({
      reconEnvironment: { url: '   ' } as any,
    });
    let thrown: any;
    try { validateEnvironmentHasUrl(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.environment.urlRequired');
  });

  it('throws when reconEnvironment is missing entirely', () => {
    const req = fakeReq();
    let thrown: any;
    try { validateEnvironmentHasUrl(req, fakeRes, () => {}); } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.environment.urlRequired');
  });

  it('calls next when url is present', () => {
    const req = fakeReq({
      reconEnvironment: { url: 'https://x' } as any,
    });
    const next = vi.fn();
    validateEnvironmentHasUrl(req, fakeRes, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('productionEnvironmentWarning', () => {
  it('is a no-op when req.reconEnvironment is missing', () => {
    const req = fakeReq();
    const next = vi.fn();
    productionEnvironmentWarning(req, fakeRes, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.reconWarnings).toBeUndefined();
  });

  it('attaches warning when name contains "prod"', () => {
    const req = fakeReq({
      reconEnvironment: { name: 'Production', url: 'x' } as any,
    });
    const next = vi.fn();
    productionEnvironmentWarning(req, fakeRes, next);
    expect(req.reconWarnings?.[0].code).toBe('recon.environment.production');
  });

  it('does not attach warning when name is "staging"', () => {
    const req = fakeReq({
      reconEnvironment: { name: 'Staging', url: 'x' } as any,
    });
    const next = vi.fn();
    productionEnvironmentWarning(req, fakeRes, next);
    expect(req.reconWarnings).toBeUndefined();
  });

  it('appends to existing warnings array rather than overwriting', () => {
    const req = fakeReq({
      reconEnvironment: { name: 'prod', url: 'x' } as any,
      reconWarnings: [{ code: 'other', messageKey: 'x', message: 'y' }],
    });
    const next = vi.fn();
    productionEnvironmentWarning(req, fakeRes, next);
    expect(req.reconWarnings).toHaveLength(2);
  });
});

describe('resumeUrlGuard', () => {
  it('throws on mismatched URLs', () => {
    const req = fakeReq();
    let thrown: any;
    try {
      resumeUrlGuard('https://a.example.com', 'https://b.example.com', req);
    } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.resume.urlMismatch');
    expect(thrown?.statusCode).toBe(400);
  });

  it('throws on subtle differences (trailing slash)', () => {
    const req = fakeReq();
    let thrown: any;
    try {
      resumeUrlGuard('https://a.example.com', 'https://a.example.com/', req);
    } catch (e) { thrown = e; }
    expect(thrown?.messageKey).toBe('errors:recon.resume.urlMismatch');
  });

  it('passes on byte-equal URLs', () => {
    const req = fakeReq();
    expect(() =>
      resumeUrlGuard('https://a.example.com', 'https://a.example.com', req),
    ).not.toThrow();
  });
});
