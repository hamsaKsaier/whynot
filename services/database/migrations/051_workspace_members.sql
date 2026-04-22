-- Migration 051: workspace_members (membership join table)
--
-- Background: workspaces were introduced in 018_add_workspaces.sql but that
-- migration only stored the OWNER on `workspaces.owner_id`. The gateway code
-- ALSO queries a `workspace_members` table in 7 places
-- (gateway/src/api/main.ts:468, me/organization.ts:66/145/187/291/306/352,
-- services/auto-fix-service.ts:282, services/qa-monitor-scheduler.ts:232)
-- to enumerate non-owner members and resolve permissions.
--
-- Until now the table only existed as manual hot-patches on v2-demo and
-- v3-sandbox — there was no migration file, so fresh deploys to production
-- would leave every logged-in page 500-ing when the gateway hit a missing
-- table. This migration creates the table authoritatively and backfills
-- owners so existing workspaces behave as if they always had a members row.
--
-- Schema is authoritative-copied from v3-sandbox's hot-patched DB
-- (columns / constraints / indexes verified via information_schema dump).

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
  ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON workspace_members(user_id);

-- Backfill: every existing workspace owner should appear as an 'owner'
-- member of their own workspace. Idempotent via ON CONFLICT — re-running
-- this migration (or running it after DevOps already seeded rows on
-- v2-demo / v3-sandbox) is a no-op.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'owner'
  FROM workspaces
 WHERE owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;
