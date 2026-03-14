import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../../shared/logger/logger';
import { AutoFixRepository, AutoFixAttemptEntity } from '../../shared/database/repositories/auto-fix-repository';
import { GitHubService } from './github-service';
import { query } from '../../shared/database/connection';

const logger = createLogger('auto-fix-service');

interface BugDetails {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  bug_type: string;
  reproduction_steps: any;
  expected_behavior: string;
  actual_behavior: string;
  screenshot_url?: string;
  page_url?: string;
  session_id: string;
  website_url?: string;
}

interface FileChange {
  path: string;
  originalContent: string;
  newContent: string;
  sha: string;
}

export class AutoFixService {
  private repository: AutoFixRepository;
  private anthropic: Anthropic;

  constructor() {
    this.repository = new AutoFixRepository();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for auto-fix service');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Start an auto-fix attempt (async - runs in background)
   */
  async startAutoFix(bugId: string, githubRepoId: string): Promise<AutoFixAttemptEntity> {
    // Create the attempt record
    const attempt = await this.repository.createAttempt({
      bug_id: bugId,
      github_repo_id: githubRepoId,
    });

    // Run the fix in background (don't await)
    this.runAutoFix(attempt.id, bugId, githubRepoId).catch((error) => {
      logger.error('Auto-fix background task failed', {
        attemptId: attempt.id,
        error: error.message,
      });
    });

    return attempt;
  }

  /**
   * Get attempt status
   */
  async getAttempt(attemptId: string): Promise<AutoFixAttemptEntity | null> {
    return this.repository.findAttemptById(attemptId);
  }

  /**
   * Get all attempts for a bug
   */
  async getAttemptsForBug(bugId: string): Promise<AutoFixAttemptEntity[]> {
    return this.repository.findAttemptsByBug(bugId);
  }

  /**
   * The main auto-fix pipeline
   */
  private async runAutoFix(attemptId: string, bugId: string, githubRepoId: string): Promise<void> {
    try {
      // Step 1: Load bug details
      await this.repository.updateAttempt(attemptId, { status: 'analyzing' });

      const bugs = await query<BugDetails>(
        `SELECT b.*, s.target_url as website_url
         FROM qa_loop_bugs b
         JOIN qa_loop_sessions s ON s.id = b.session_id
         WHERE b.id = $1`,
        [bugId]
      );

      if (bugs.length === 0) {
        throw new Error(`Bug not found: ${bugId}`);
      }

      const bug = bugs[0];

      // Load GitHub repo config
      const repo = await this.repository.findRepoById(githubRepoId);
      if (!repo || !repo.access_token) {
        throw new Error('GitHub repo not found or missing access token');
      }

      const github = new GitHubService(repo.access_token, repo.owner, repo.repo);

      // Step 2: Get repo tree and find relevant files
      const defaultBranch = await github.getDefaultBranch();
      const tree = await github.getRepoTree(defaultBranch);

      const relevantPaths = await github.findRelevantFiles(tree, {
        pageUrl: bug.page_url || bug.website_url,
        title: bug.title,
        description: bug.description,
        reproduction_steps: typeof bug.reproduction_steps === 'string'
          ? JSON.parse(bug.reproduction_steps) : bug.reproduction_steps,
      });

      if (relevantPaths.length === 0) {
        throw new Error('Could not find any relevant source files in the repository');
      }

      await this.repository.updateAttempt(attemptId, {
        relevant_files: relevantPaths,
      });

      logger.info('Found relevant files', { attemptId, files: relevantPaths });

      // Step 3: Read file contents
      const fileContents: { path: string; content: string; sha: string }[] = [];
      let totalSize = 0;
      const maxTotalSize = 50000; // 50KB limit for context

      for (const filePath of relevantPaths) {
        if (totalSize >= maxTotalSize) break;
        try {
          const file = await github.getFileContent(filePath, defaultBranch);
          if (totalSize + file.content.length <= maxTotalSize) {
            fileContents.push({ path: filePath, content: file.content, sha: file.sha });
            totalSize += file.content.length;
          }
        } catch (error: any) {
          logger.warn('Failed to read file', { path: filePath, error: error.message });
        }
      }

      if (fileContents.length === 0) {
        throw new Error('Could not read any source files from the repository');
      }

      // Step 4: Generate fix using Claude
      await this.repository.updateAttempt(attemptId, { status: 'generating' });

      const fixResult = await this.generateFix(bug, fileContents);

      if (!fixResult.changes || fixResult.changes.length === 0) {
        throw new Error('Claude could not generate a fix for this bug');
      }

      await this.repository.updateAttempt(attemptId, {
        generated_diff: fixResult.diff,
        claude_reasoning: fixResult.reasoning,
      });

      // Step 5: Create branch and PR
      const branchName = `autofix/bug-${bugId.slice(0, 8)}`;

      await github.createBranch(branchName, defaultBranch);

      // Commit each changed file
      for (const change of fixResult.changes) {
        const originalFile = fileContents.find(f => f.path === change.path);
        await github.updateFile(
          change.path,
          change.newContent,
          `fix: ${bug.title}\n\nAuto-fix generated by WhyNot QA`,
          branchName,
          originalFile?.sha
        );
      }

      // Create the PR
      const prBody = this.buildPRBody(bug, fixResult, relevantPaths);
      const pr = await github.createPullRequest({
        title: `[Auto-Fix] ${bug.title}`,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      await this.repository.updateAttempt(attemptId, {
        status: 'pr_created',
        branch_name: branchName,
        pr_number: pr.number,
        pr_url: pr.html_url,
      });

      logger.info('Auto-fix PR created', {
        attemptId,
        prNumber: pr.number,
        prUrl: pr.html_url,
      });

    } catch (error: any) {
      logger.error('Auto-fix failed', { attemptId, error: error.message });
      await this.repository.updateAttempt(attemptId, {
        status: 'failed',
        error_message: error.message,
      });
    }
  }

  /**
   * Use Claude to generate a code fix
   */
  private async generateFix(
    bug: BugDetails,
    files: { path: string; content: string; sha: string }[]
  ): Promise<{
    changes: FileChange[];
    reasoning: string;
    diff: string;
  }> {
    const reproSteps = typeof bug.reproduction_steps === 'string'
      ? JSON.parse(bug.reproduction_steps)
      : bug.reproduction_steps;

    const stepsText = Array.isArray(reproSteps)
      ? reproSteps.map((s: any, i: number) =>
          `${i + 1}. ${typeof s === 'string' ? s : s.description || s.action || JSON.stringify(s)}`
        ).join('\n')
      : 'No reproduction steps available';

    const filesContext = files.map(f =>
      `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
    ).join('\n\n');

    const prompt = `You are an expert software engineer. A QA automation tool found the following bug in a web application. Your job is to analyze the relevant source code and generate a fix.

## Bug Report

**Title:** ${bug.title}
**Severity:** ${bug.severity}
**Category:** ${bug.category || 'unknown'}
**Page URL:** ${bug.page_url || bug.website_url || 'N/A'}

**Description:**
${bug.description || 'No description'}

**Expected Behavior:**
${bug.expected_behavior || 'Not specified'}

**Actual Behavior:**
${bug.actual_behavior || 'Not specified'}

**Reproduction Steps:**
${stepsText}

## Source Code

${filesContext}

## Instructions

1. Analyze the bug and the source code
2. Identify the root cause
3. Generate a fix

Respond with a JSON object in this exact format:
{
  "reasoning": "Explain what causes the bug and how your fix addresses it",
  "changes": [
    {
      "path": "path/to/file.ts",
      "content": "FULL new content of the file with the fix applied"
    }
  ]
}

IMPORTANT:
- Each "content" field must contain the COMPLETE file content (not a diff)
- Only modify files that need changes
- Make minimal, focused changes
- Ensure the fix is correct and doesn't break other functionality
- Return ONLY the JSON object, no other text`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    // Parse the JSON response
    let parsed: any;
    try {
      // Try to extract JSON from the response (Claude sometimes wraps in markdown)
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      logger.error('Failed to parse Claude fix response', {
        error: parseError.message,
        response: textContent.substring(0, 500),
      });
      throw new Error(`Failed to parse fix: ${parseError.message}`);
    }

    // Build changes array with original content for diff
    const changes: FileChange[] = [];
    const diffLines: string[] = [];

    for (const change of parsed.changes || []) {
      const originalFile = files.find(f => f.path === change.path);
      if (!originalFile) continue;

      changes.push({
        path: change.path,
        originalContent: originalFile.content,
        newContent: change.content,
        sha: originalFile.sha,
      });

      // Generate a simple diff summary
      const originalLines = originalFile.content.split('\n');
      const newLines = change.content.split('\n');
      diffLines.push(`--- a/${change.path}`);
      diffLines.push(`+++ b/${change.path}`);
      diffLines.push(`@@ Modified file (${originalLines.length} -> ${newLines.length} lines) @@`);
    }

    return {
      changes,
      reasoning: parsed.reasoning || 'No reasoning provided',
      diff: diffLines.join('\n'),
    };
  }

  /**
   * Build PR description
   */
  private buildPRBody(
    bug: BugDetails,
    fixResult: { reasoning: string; changes: FileChange[] },
    relevantFiles: string[]
  ): string {
    const reproSteps = typeof bug.reproduction_steps === 'string'
      ? JSON.parse(bug.reproduction_steps)
      : bug.reproduction_steps;

    const stepsText = Array.isArray(reproSteps)
      ? reproSteps.map((s: any, i: number) =>
          `${i + 1}. ${typeof s === 'string' ? s : s.description || s.action || JSON.stringify(s)}`
        ).join('\n')
      : 'No reproduction steps available';

    return `## Bug Fix

**Bug:** ${bug.title}
**Severity:** ${bug.severity}
**Page:** ${bug.page_url || bug.website_url || 'N/A'}

### Description
${bug.description || 'No description'}

### Reproduction Steps
${stepsText}

### Root Cause Analysis
${fixResult.reasoning}

### Files Changed
${fixResult.changes.map(c => `- \`${c.path}\``).join('\n')}

### Files Analyzed
${relevantFiles.map(f => `- \`${f}\``).join('\n')}

---
*This PR was automatically generated by [WhyNot QA](https://github.com) - Autonomous Testing Platform*
*Please review the changes carefully before merging.*`;
  }

  // ─── GitHub Repos CRUD ───

  async getRepos(workspaceId: string) {
    return this.repository.findReposByWorkspace(workspaceId);
  }

  async createRepo(input: {
    workspace_id: string;
    owner: string;
    repo: string;
    default_branch?: string;
    access_token?: string;
  }) {
    return this.repository.createRepo(input);
  }

  async deleteRepo(id: string) {
    return this.repository.deleteRepo(id);
  }

  async testRepoConnection(repoId: string): Promise<{ success: boolean; message: string }> {
    const repo = await this.repository.findRepoById(repoId);
    if (!repo || !repo.access_token) {
      return { success: false, message: 'Repo not found or missing token' };
    }
    const github = new GitHubService(repo.access_token, repo.owner, repo.repo);
    return github.testConnection();
  }
}
