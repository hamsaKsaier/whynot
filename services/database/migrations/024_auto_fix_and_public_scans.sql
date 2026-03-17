-- Migration 024: Auto-Fix Tables + Public Scan Requests
-- Creates tables for GitHub repo connections, auto-fix attempt tracking (with retest loop),
-- and public scan rate limiting/email capture.

-- ─── GitHub Repos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS github_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner VARCHAR(255) NOT NULL,
  repo VARCHAR(255) NOT NULL,
  default_branch VARCHAR(100) DEFAULT 'main',
  access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, owner, repo)
);

CREATE INDEX IF NOT EXISTS idx_github_repos_workspace ON github_repos(workspace_id);

-- ─── Auto-Fix Attempts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_fix_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES qa_loop_bugs(id) ON DELETE CASCADE,
  github_repo_id UUID NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'generating', 'pr_created', 'retesting', 'verified', 'failed', 'needs_review')),
  branch_name VARCHAR(255),
  pr_number INTEGER,
  pr_url TEXT,
  relevant_files JSONB,
  generated_diff TEXT,
  claude_reasoning TEXT,
  verification_status VARCHAR(20)
    CHECK (verification_status IS NULL OR verification_status IN ('pass', 'fail', 'partial', 'regression')),
  verification_session_id UUID,
  iteration_count INTEGER DEFAULT 1,
  max_iterations INTEGER DEFAULT 3,
  quality_score_before INTEGER,
  quality_score_after INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_fix_bug ON auto_fix_attempts(bug_id);
CREATE INDEX IF NOT EXISTS idx_auto_fix_status ON auto_fix_attempts(status);
CREATE INDEX IF NOT EXISTS idx_auto_fix_repo ON auto_fix_attempts(github_repo_id);

-- ─── Public Scan Requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_scan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE SET NULL,
  ip_address VARCHAR(45) NOT NULL,
  email VARCHAR(255),
  target_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_scans_ip ON public_scan_requests(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_public_scans_session ON public_scan_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_public_scans_email ON public_scan_requests(email) WHERE email IS NOT NULL;
