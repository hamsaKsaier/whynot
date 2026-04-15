import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { WorkspaceRepository } from '../../../shared/database/repositories/workspace-repository';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';

const router = express.Router();
const logger = createLogger('me-organization');
const workspaceRepo = new WorkspaceRepository();
const audit = new AuditRepository();

interface WorkspaceMemberRow {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  created_at: Date;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
}

interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string;
  created_at: Date;
  expires_at: Date | null;
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

const inviteSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  role: z.enum(['member', 'admin']).optional().default('member'),
});

const transferSchema = z.object({
  newOwnerId: z.string().uuid('Invalid user ID'),
});

// GET /api/me/organization — return workspace name + members list
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const workspaceId = req.workspaceId!;

    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw createError('Workspace not found', 404, 'NOT_FOUND');
    }

    const members = await query<WorkspaceMemberRow>(
      `SELECT wm.id, wm.user_id, wm.workspace_id, wm.role, wm.created_at,
              u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.created_at ASC`,
      [workspaceId]
    );

    res.json({
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      isOwner: workspace.owner_id === userId,
      createdAt: workspace.created_at,
      members: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        name: m.user_name,
        email: m.user_email,
        avatarUrl: m.user_avatar_url,
        role: m.role,
        createdAt: m.created_at,
      })),
    });
  })
);

// PATCH /api/me/organization — update workspace name
router.patch(
  '/',
  requireAuth,
  validate(updateWorkspaceSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const workspaceId = req.workspaceId!;
    const { name } = req.body;

    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw createError('Workspace not found', 404, 'NOT_FOUND');
    }

    if (workspace.owner_id !== userId) {
      throw createError('Only the workspace owner can rename it', 403, 'FORBIDDEN');
    }

    const updated = await workspaceRepo.update(workspaceId, name);

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'organization.renamed',
      target_type: 'workspace',
      target_id: workspaceId,
      details: { name },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Workspace renamed', { userId, workspaceId, name });

    res.json({
      id: updated!.id,
      name: updated!.name,
      ownerId: updated!.owner_id,
      createdAt: updated!.created_at,
    });
  })
);

// GET /api/me/organization/members — list workspace members
router.get(
  '/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = req.workspaceId!;

    const members = await query<WorkspaceMemberRow>(
      `SELECT wm.id, wm.user_id, wm.workspace_id, wm.role, wm.created_at,
              u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.created_at ASC`,
      [workspaceId]
    );

    res.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        name: m.user_name,
        email: m.user_email,
        avatarUrl: m.user_avatar_url,
        role: m.role,
        createdAt: m.created_at,
      })),
    });
  })
);

// POST /api/me/organization/invitations — invite a member by email
router.post(
  '/invitations',
  requireAuth,
  validate(inviteSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const workspaceId = req.workspaceId!;
    const { email, role } = req.body;

    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw createError('Workspace not found', 404, 'NOT_FOUND');
    }

    if (workspace.owner_id !== userId) {
      throw createError('Only the workspace owner can invite members', 403, 'FORBIDDEN');
    }

    // Check if already a member
    const existingMember = await query<{ id: string }>(
      `SELECT wm.id FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND u.email = $2`,
      [workspaceId, email]
    );

    if (existingMember.length > 0) {
      throw createError('User is already a member of this workspace', 409, 'ALREADY_MEMBER');
    }

    // Check for existing pending invitation
    const existingInvite = await query<{ id: string }>(
      `SELECT id FROM workspace_invitations
       WHERE workspace_id = $1 AND email = $2 AND status = 'pending'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [workspaceId, email]
    );

    if (existingInvite.length > 0) {
      throw createError('An invitation has already been sent to this email', 409, 'ALREADY_INVITED');
    }

    const rows = await query<InvitationRow>(
      `INSERT INTO workspace_invitations (workspace_id, email, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
       RETURNING *`,
      [workspaceId, email, role, userId]
    );

    const invitation = rows[0];

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'organization.member-invited',
      target_type: 'workspace',
      target_id: workspaceId,
      details: { invitedEmail: email, role },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Member invited', { userId, workspaceId, invitedEmail: email });

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.created_at,
      expiresAt: invitation.expires_at,
    });
  })
);

// GET /api/me/organization/invitations — list pending invitations
router.get(
  '/invitations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = req.workspaceId!;

    const invitations = await query<InvitationRow>(
      `SELECT id, workspace_id, email, role, invited_by, created_at, expires_at
       FROM workspace_invitations
       WHERE workspace_id = $1 AND status = 'pending'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    res.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: 'pending',
        invitedBy: inv.invited_by,
        createdAt: inv.created_at,
        expiresAt: inv.expires_at,
      })),
    });
  })
);

// DELETE /api/me/organization/members/:memberId — remove member
router.delete(
  '/members/:memberId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const workspaceId = req.workspaceId!;
    const { memberId } = req.params;

    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw createError('Workspace not found', 404, 'NOT_FOUND');
    }

    if (workspace.owner_id !== userId) {
      throw createError('Only the workspace owner can remove members', 403, 'FORBIDDEN');
    }

    // Find the member record
    const memberRows = await query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM workspace_members WHERE id = $1 AND workspace_id = $2',
      [memberId, workspaceId]
    );

    if (memberRows.length === 0) {
      throw createError('Member not found', 404, 'NOT_FOUND');
    }

    const member = memberRows[0];

    if (member.user_id === workspace.owner_id) {
      throw createError('Cannot remove the workspace owner', 400, 'CANNOT_REMOVE_OWNER');
    }

    await query(
      'DELETE FROM workspace_members WHERE id = $1 AND workspace_id = $2',
      [memberId, workspaceId]
    );

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'organization.member-removed',
      target_type: 'workspace',
      target_id: workspaceId,
      details: { removedMemberId: memberId, removedUserId: member.user_id },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Member removed', { userId, workspaceId, memberId });

    res.json({ success: true });
  })
);

// POST /api/me/organization/transfer — transfer workspace ownership
router.post(
  '/transfer',
  requireAuth,
  validate(transferSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const workspaceId = req.workspaceId!;
    const { newOwnerId } = req.body;

    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw createError('Workspace not found', 404, 'NOT_FOUND');
    }

    if (workspace.owner_id !== userId) {
      throw createError('Only the workspace owner can transfer ownership', 403, 'FORBIDDEN');
    }

    if (newOwnerId === userId) {
      throw createError('You are already the owner', 400, 'ALREADY_OWNER');
    }

    // Verify the new owner is a member of the workspace
    const memberRows = await query<{ id: string }>(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, newOwnerId]
    );

    if (memberRows.length === 0) {
      throw createError('New owner must be a member of the workspace', 400, 'NOT_A_MEMBER');
    }

    await query(
      'UPDATE workspaces SET owner_id = $1 WHERE id = $2',
      [newOwnerId, workspaceId]
    );

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'organization.ownership-transferred',
      target_type: 'workspace',
      target_id: workspaceId,
      details: { previousOwnerId: userId, newOwnerId },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Workspace ownership transferred', { userId, workspaceId, newOwnerId });

    res.json({ success: true, message: 'Ownership transferred successfully' });
  })
);

export default router;
