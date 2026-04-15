/**
 * integrations-router.ts
 *
 * Dedicated Express router for ClickUp + GitHub bug-reporting integrations.
 * Endpoints:
 *   POST   /api/integrations/clickup/connect       — save encrypted ClickUp API token
 *   GET    /api/integrations/clickup/workspaces     — fetch user's ClickUp workspaces
 *   GET    /api/integrations/clickup/lists/:workspaceId — fetch lists in a workspace
 *   POST   /api/integrations/clickup/save-config    — save selected workspace + list
 *   GET    /api/integrations/clickup/status          — check if connected
 *   GET    /api/integrations/github/status           — check GitHub connected status
 *   GET    /api/integrations/github/repos            — list repos for issue target
 *   POST   /api/integrations/github/save-config      — save selected repo
 *   POST   /api/bugs/:bugId/report                  — report single bug
 *   POST   /api/sessions/:sessionId/report-all      — batch report all bugs
 */

import express from 'express';
import crypto from 'crypto';
import { asyncHandler, createError } from '../middleware/error-handler';
import { query } from '../../shared/database/connection';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';

const router = express.Router();
const logger = createLogger('integrations-router');

// ── Encryption helpers ────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for token encryption');
  }
  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── Helper: get user integration ──────────────────────────────────────────────

async function getUserIntegration(userId: string, provider: string) {
  const rows = await query<any>(
    'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );
  return rows[0] || null;
}

// ── ClickUp Endpoints ─────────────────────────────────────────────────────────

// POST /api/integrations/clickup/connect — save ClickUp API token
router.post('/clickup/connect', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { apiToken } = req.body;

  if (!apiToken || typeof apiToken !== 'string') {
    throw createError((req as any).t('errors:validation.apiTokenRequired'), 400, 'VALIDATION_ERROR');
  }

  // Verify the token works
  const verifyRes = await fetch('https://api.clickup.com/api/v2/user', {
    headers: { Authorization: apiToken, 'Content-Type': 'application/json' },
  });

  if (!verifyRes.ok) {
    throw createError((req as any).t('errors:integration.clickupInvalidToken'), 400, 'INVALID_TOKEN');
  }

  const userData: any = await verifyRes.json();
  const encryptedToken = encrypt(apiToken);

  // Upsert
  await query(
    `INSERT INTO user_integrations (user_id, provider, encrypted_token, config)
     VALUES ($1, 'clickup', $2, $3)
     ON CONFLICT (user_id, provider) DO UPDATE
     SET encrypted_token = $2, config = user_integrations.config || $3, updated_at = NOW()`,
    [userId, encryptedToken, JSON.stringify({ username: userData.user?.username || 'ClickUp User' })]
  );

  res.json({ success: true, username: userData.user?.username || 'ClickUp User' });
}));

// GET /api/integrations/clickup/workspaces — fetch user's ClickUp workspaces
router.get('/clickup/workspaces', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const integration = await getUserIntegration(userId, 'clickup');

  if (!integration?.encrypted_token) {
    throw createError((req as any).t('errors:integration.clickupNotConnected'), 400, 'NOT_CONNECTED');
  }

  const token = decrypt(integration.encrypted_token);
  const response = await fetch('https://api.clickup.com/api/v2/team', {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw createError((req as any).t('errors:integration.clickupApiError', { status: String(response.status) }), 502, 'CLICKUP_API_ERROR');
  }

  const data: any = await response.json();
  const workspaces = (data.teams || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    avatar: t.avatar,
    members: t.members?.length || 0,
  }));

  res.json({ workspaces });
}));

// GET /api/integrations/clickup/lists/:workspaceId — fetch lists in workspace
router.get('/clickup/lists/:workspaceId', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { workspaceId } = req.params;
  const integration = await getUserIntegration(userId, 'clickup');

  if (!integration?.encrypted_token) {
    throw createError((req as any).t('errors:integration.clickupNotConnected'), 400, 'NOT_CONNECTED');
  }

  const token = decrypt(integration.encrypted_token);

  // Get spaces in workspace
  const spacesRes = await fetch(`https://api.clickup.com/api/v2/team/${workspaceId}/space?archived=false`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });

  if (!spacesRes.ok) {
    throw createError((req as any).t('errors:integration.clickupApiError', { status: String(spacesRes.status) }), 502, 'CLICKUP_API_ERROR');
  }

  const spacesData: any = await spacesRes.json();
  const allLists: any[] = [];

  // For each space, get folders and folderless lists
  for (const space of spacesData.spaces || []) {
    // Folderless lists
    const listsRes = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
    });
    if (listsRes.ok) {
      const listsData: any = await listsRes.json();
      for (const list of listsData.lists || []) {
        allLists.push({
          id: list.id,
          name: list.name,
          space: space.name,
          folder: null,
        });
      }
    }

    // Folders and their lists
    const foldersRes = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
    });
    if (foldersRes.ok) {
      const foldersData: any = await foldersRes.json();
      for (const folder of foldersData.folders || []) {
        for (const list of folder.lists || []) {
          allLists.push({
            id: list.id,
            name: list.name,
            space: space.name,
            folder: folder.name,
          });
        }
      }
    }
  }

  res.json({ lists: allLists });
}));

// POST /api/integrations/clickup/save-config — save selected workspace + list
router.post('/clickup/save-config', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { workspaceId, workspaceName, listId, listName } = req.body;

  if (!listId) {
    throw createError((req as any).t('errors:validation.listIdRequired'), 400, 'VALIDATION_ERROR');
  }

  await query(
    `UPDATE user_integrations
     SET config = config || $1, updated_at = NOW()
     WHERE user_id = $2 AND provider = 'clickup'`,
    [JSON.stringify({ workspaceId, workspaceName, listId, listName }), userId]
  );

  res.json({ success: true });
}));

// GET /api/integrations/clickup/status — check if connected
router.get('/clickup/status', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const integration = await getUserIntegration(userId, 'clickup');

  if (!integration?.encrypted_token) {
    return res.json({ connected: false });
  }

  const config = integration.config || {};
  res.json({
    connected: true,
    username: config.username || null,
    workspaceId: config.workspaceId || null,
    workspaceName: config.workspaceName || null,
    listId: config.listId || null,
    listName: config.listName || null,
  });
}));

// ── GitHub Endpoints ──────────────────────────────────────────────────────────

// GET /api/integrations/github/status — check GitHub connected status
router.get('/github/status', asyncHandler(async (req, res) => {
  const userId = req.user!.id;

  // Check if user has GitHub ID (OAuth connected)
  const users = await query<any>(
    'SELECT github_id FROM users WHERE id = $1',
    [userId]
  );
  const hasGithub = !!users[0]?.github_id;

  // Check for saved GitHub config
  const integration = await getUserIntegration(userId, 'github');
  const config = integration?.config || {};

  res.json({
    connected: hasGithub,
    githubId: users[0]?.github_id || null,
    repoOwner: config.repoOwner || null,
    repoName: config.repoName || null,
    repoFullName: config.repoOwner && config.repoName ? `${config.repoOwner}/${config.repoName}` : null,
  });
}));

// GET /api/integrations/github/repos — list available repos
router.get('/github/repos', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const workspaceId = req.workspaceId;

  // Get repos from github_repos table (already connected via auto-fix)
  const repos = await query<any>(
    `SELECT id, owner, repo, default_branch FROM github_repos WHERE workspace_id = $1 ORDER BY repo ASC`,
    [workspaceId]
  );

  res.json({ repos });
}));

// POST /api/integrations/github/save-config — save selected repo for issues
router.post('/github/save-config', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { repoOwner, repoName } = req.body;

  if (!repoOwner || !repoName) {
    throw createError((req as any).t('errors:validation.repoFieldsRequired'), 400, 'VALIDATION_ERROR');
  }

  // Upsert github config
  await query(
    `INSERT INTO user_integrations (user_id, provider, config)
     VALUES ($1, 'github', $2)
     ON CONFLICT (user_id, provider) DO UPDATE
     SET config = $2, updated_at = NOW()`,
    [userId, JSON.stringify({ repoOwner, repoName })]
  );

  res.json({ success: true });
}));

// ── Bug Reporting Router (mounted at /api) ────────────────────────────────────
const bugReportRouter = express.Router();

interface BugRow {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  bug_type: string | null;
  reproduction_steps: any;
  page_url: string | null;
  video_path: string | null;
  session_id: string;
  reported_to: string | null;
  external_url: string | null;
  target_url: string;
}

function buildBugMarkdown(bug: BugRow, baseUrl: string): string {
  const lines: string[] = [];
  lines.push(`## Bug: ${bug.title}`);
  lines.push('');
  lines.push(`**Severity:** ${bug.severity || 'medium'}`);
  if (bug.category) lines.push(`**Category:** ${bug.category}`);
  if (bug.bug_type) lines.push(`**Type:** ${bug.bug_type}`);
  if (bug.page_url) lines.push(`**Page URL:** ${bug.page_url}`);
  lines.push('');

  if (bug.description) {
    lines.push('### Description');
    lines.push(bug.description);
    lines.push('');
  }

  const steps = typeof bug.reproduction_steps === 'string'
    ? JSON.parse(bug.reproduction_steps)
    : bug.reproduction_steps;
  if (Array.isArray(steps) && steps.length > 0) {
    lines.push('### Reproduction Steps');
    steps.forEach((step: any, i: number) => {
      const text = typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step);
      lines.push(`${i + 1}. ${text}`);
    });
    lines.push('');
  }

  if (bug.video_path) {
    lines.push('### Video Recording');
    lines.push(`[Watch session recording](${baseUrl}/api/videos/${bug.video_path})`);
    lines.push('');
  }

  // Deep link back to WhyNot
  lines.push('---');
  lines.push(`[View in WhyNot](${baseUrl}/qa-loop?session=${bug.session_id})`);
  lines.push('');
  lines.push('*Reported by [WhyNot QA](https://whynot.qa) - Autonomous Testing Platform*');

  return lines.join('\n');
}

function mapSeverityToClickUpPriority(severity: string): number {
  switch (severity?.toLowerCase()) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    case 'low': return 4;
    default: return 3;
  }
}

async function reportBugToClickUp(bug: BugRow, userId: string): Promise<{ externalUrl: string }> {
  const integration = await getUserIntegration(userId, 'clickup');
  if (!integration?.encrypted_token) {
    throw createError('ClickUp not connected', 400, 'NOT_CONNECTED');
  }

  const config = integration.config || {};
  if (!config.listId) {
    throw createError('ClickUp list not configured', 400, 'NOT_CONFIGURED');
  }

  const token = decrypt(integration.encrypted_token);
  const baseUrl = env.FRONTEND_URL || env.GATEWAY_URL || 'http://localhost:3010';
  const description = buildBugMarkdown(bug, baseUrl);

  const taskData = {
    name: `[Bug] ${bug.title}`,
    description,
    priority: mapSeverityToClickUpPriority(bug.severity),
    tags: ['bug', 'whynot-qa'],
  };

  const response = await fetch(`https://api.clickup.com/api/v2/list/${config.listId}/task`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createError(`ClickUp API error: ${response.status}`, 502, 'CLICKUP_API_ERROR');
  }

  const result: any = await response.json();
  return { externalUrl: result.url };
}

async function reportBugToGithub(bug: BugRow, userId: string, workspaceId: string): Promise<{ externalUrl: string }> {
  // Get github config
  const integration = await getUserIntegration(userId, 'github');
  const config = integration?.config || {};

  if (!config.repoOwner || !config.repoName) {
    throw createError('GitHub repo not configured', 400, 'NOT_CONFIGURED');
  }

  // Get the access token from github_repos table
  const repos = await query<any>(
    `SELECT access_token FROM github_repos WHERE workspace_id = $1 AND owner = $2 AND repo = $3 LIMIT 1`,
    [workspaceId, config.repoOwner, config.repoName]
  );

  if (!repos[0]?.access_token) {
    throw createError('GitHub repo access token not found', 400, 'NO_TOKEN');
  }

  const token = repos[0].access_token;
  const baseUrl = env.FRONTEND_URL || env.GATEWAY_URL || 'http://localhost:3010';
  const body = buildBugMarkdown(bug, baseUrl);

  // Determine labels based on severity
  const labels = ['bug', 'whynot-qa'];
  if (bug.severity === 'critical') labels.push('priority: critical');
  else if (bug.severity === 'high') labels.push('priority: high');

  const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[Bug] ${bug.title}`,
      body,
      labels,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createError(`GitHub API error: ${response.status}`, 502, 'GITHUB_API_ERROR');
  }

  const result: any = await response.json();
  return { externalUrl: result.html_url };
}

// POST /api/bugs/:bugId/report — report a single bug
bugReportRouter.post('/bugs/:bugId/report', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const workspaceId = req.workspaceId || '';
  const { bugId } = req.params;
  const { provider } = req.body;

  if (!provider || !['clickup', 'github'].includes(provider)) {
    throw createError((req as any).t('errors:validation.providerInvalid'), 400, 'VALIDATION_ERROR');
  }

  // Load bug
  const bugs = await query<BugRow>(
    `SELECT b.*, s.target_url FROM qa_loop_bugs b
     JOIN qa_loop_sessions s ON s.id = b.session_id
     WHERE b.id = $1`,
    [bugId]
  );

  if (bugs.length === 0) {
    throw createError((req as any).t('errors:resource.bugNotFound'), 404, 'NOT_FOUND');
  }

  const bug = bugs[0];

  let externalUrl: string;
  if (provider === 'clickup') {
    const result = await reportBugToClickUp(bug, userId);
    externalUrl = result.externalUrl;
  } else {
    const result = await reportBugToGithub(bug, userId, workspaceId);
    externalUrl = result.externalUrl;
  }

  // Update bug record
  await query(
    `UPDATE qa_loop_bugs SET reported_to = $1, external_url = $2, reported_at = NOW() WHERE id = $3`,
    [provider, externalUrl, bugId]
  );

  res.json({ success: true, provider, externalUrl });
}));

// POST /api/sessions/:sessionId/report-all — batch report all bugs from a session
bugReportRouter.post('/sessions/:sessionId/report-all', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const workspaceId = req.workspaceId || '';
  const { sessionId } = req.params;
  const { provider } = req.body;

  if (!provider || !['clickup', 'github'].includes(provider)) {
    throw createError((req as any).t('errors:validation.providerInvalid'), 400, 'VALIDATION_ERROR');
  }

  // Load all unreported bugs from session
  const bugs = await query<BugRow>(
    `SELECT b.*, s.target_url FROM qa_loop_bugs b
     JOIN qa_loop_sessions s ON s.id = b.session_id
     WHERE b.session_id = $1 AND b.reported_to IS NULL
     ORDER BY b.created_at ASC`,
    [sessionId]
  );

  if (bugs.length === 0) {
    return res.json({ success: true, reported: 0, total: 0, results: [] });
  }

  const results: Array<{ bugId: string; success: boolean; externalUrl?: string; error?: string }> = [];

  for (const bug of bugs) {
    try {
      let externalUrl: string;
      if (provider === 'clickup') {
        const result = await reportBugToClickUp(bug, userId);
        externalUrl = result.externalUrl;
      } else {
        const result = await reportBugToGithub(bug, userId, workspaceId);
        externalUrl = result.externalUrl;
      }

      await query(
        `UPDATE qa_loop_bugs SET reported_to = $1, external_url = $2, reported_at = NOW() WHERE id = $3`,
        [provider, externalUrl, bug.id]
      );

      results.push({ bugId: bug.id, success: true, externalUrl });
    } catch (err: any) {
      logger.error('Failed to report bug', { bugId: bug.id, provider, error: err.message });
      results.push({ bugId: bug.id, success: false, error: err.message });
    }
  }

  const reported = results.filter(r => r.success).length;
  res.json({ success: true, reported, total: bugs.length, results });
}));

export { router as integrationsRouter, bugReportRouter };
