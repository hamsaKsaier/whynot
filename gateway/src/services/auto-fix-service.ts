import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { createLogger } from '../../shared/logger/logger';
import { AutoFixRepository, AutoFixAttemptEntity } from '../../shared/database/repositories/auto-fix-repository';
import { GitHubService } from './github-service';
import { query } from '../../shared/database/connection';

const logger = createLogger('auto-fix-service');

const qaLoopExecutorUrl =
  process.env.QA_LOOP_EXECUTOR_URL || 'http://localhost:3002';

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

interface RetestResult {
  sessionId: string;
  qualityScore: number;
  bugStillExists: boolean;
  newBugsFound: number;
  status: 'pass' | 'fail' | 'partial' | 'regression';
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
   * Start an auto-fix attempt (async - runs in background, PR only — no retest loop)
   */
  async startAutoFix(bugId: string, githubRepoId: string): Promise<AutoFixAttemptEntity> {
    const attempt = await this.repository.createAttempt({
      bug_id: bugId,
      github_repo_id: githubRepoId,
    });

    // Run the fix in background (don't await)
    this.runAutoFix(attempt.id, bugId, githubRepoId, false).catch((error) => {
      logger.error('Auto-fix background task failed', {
        attemptId: attempt.id,
        error: error.message,
      });
    });

    return attempt;
  }

  /**
   * Start an auto-fix + retest loop (the killer feature)
   * Fix code → Create PR → Retest → Iterate until quality target hit
   */
  async startAutoFixLoop(
    bugId: string,
    githubRepoId: string,
    options?: { maxIterations?: number; qualityThreshold?: number; workspaceId?: string; autoMerge?: boolean }
  ): Promise<AutoFixAttemptEntity> {
    const maxIterations = options?.maxIterations || 3;
    const qualityThreshold = options?.qualityThreshold || 80;

    const attempt = await this.repository.createAttempt({
      bug_id: bugId,
      github_repo_id: githubRepoId,
    });

    // Store max iterations
    await this.repository.updateAttempt(attempt.id, {
      max_iterations: maxIterations,
    });

    // Capture the quality score before fix
    const sessions = await query<{ quality_score: number }>(
      `SELECT s.quality_score FROM qa_loop_sessions s
       JOIN qa_loop_bugs b ON b.session_id = s.id
       WHERE b.id = $1`,
      [bugId]
    );
    if (sessions.length > 0 && sessions[0].quality_score) {
      await this.repository.updateAttempt(attempt.id, {
        quality_score_before: sessions[0].quality_score,
      });
    }

    // Run the full fix→merge→retest→iterate loop in background
    this.runAutoFix(attempt.id, bugId, githubRepoId, true, {
      maxIterations,
      qualityThreshold,
      workspaceId: options?.workspaceId,
      autoMerge: options?.autoMerge ?? true,
    }).catch((error) => {
      logger.error('Auto-fix loop background task failed', {
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

  // ─── The Main Auto-Fix Pipeline ────────────────────────────────────────────

  /**
   * The main auto-fix pipeline (optionally with retest loop)
   */
  private async runAutoFix(
    attemptId: string,
    bugId: string,
    githubRepoId: string,
    enableRetestLoop: boolean,
    loopOptions?: { maxIterations?: number; qualityThreshold?: number; workspaceId?: string; autoMerge?: boolean }
  ): Promise<void> {
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
      const fileContents = await this.readRepoFiles(github, relevantPaths, defaultBranch);

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
      const branchName = `autofix/bug-${bugId.slice(0, 8)}-${Date.now().toString(36)}`;

      await github.createBranch(branchName, defaultBranch);

      // Commit each changed file
      for (const change of fixResult.changes) {
        const originalFile = fileContents.find(f => f.path === change.path);
        await github.updateFile(
          change.path,
          change.newContent,
          `fix: ${bug.title}\n\nAuto-fix generated by WhyNot QA (iteration 1)`,
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
        iteration_count: 1,
      });

      logger.info('Auto-fix PR created', {
        attemptId,
        prNumber: pr.number,
        prUrl: pr.html_url,
      });

      // Step 6: Auto-merge + retest loop (if enabled)
      if (enableRetestLoop && loopOptions) {
        // Merge the PR before retesting so the live app reflects the fix
        if (loopOptions.autoMerge) {
          await this.repository.updateAttempt(attemptId, { status: 'merging' as any });
          try {
            await github.mergePullRequest(pr.number, `fix: ${bug.title}\n\nAuto-merged by WhyNot QA`);
            logger.info('Auto-merged PR before retest', { attemptId, prNumber: pr.number });
          } catch (mergeError: any) {
            logger.error('Failed to auto-merge PR', { attemptId, error: mergeError.message });
            await this.repository.updateAttempt(attemptId, {
              status: 'needs_review',
              error_message: `PR created but auto-merge failed: ${mergeError.message}. Please merge manually.`,
            });
            await github.addPRComment(pr.number,
              `⚠️ **Auto-merge failed**: ${mergeError.message}\n\nPlease merge this PR manually, then trigger a retest.`
            ).catch(err => logger.warn('Failed to post merge-fail comment', { error: err.message }));
            return;
          }
        }

        await this.retestAndIterate(
          attemptId,
          bug,
          github,
          branchName,
          defaultBranch,
          pr.number,
          fileContents,
          fixResult,
          loopOptions,
        );
      }

    } catch (error: any) {
      logger.error('Auto-fix failed', { attemptId, error: error.message });
      await this.repository.updateAttempt(attemptId, {
        status: 'failed',
        error_message: error.message,
      });
    }
  }

  // ─── Retest + Iterate Loop ─────────────────────────────────────────────────

  /**
   * After PR is created: trigger QA retest → check quality → iterate if needed
   *
   * Loop:
   *   1. Trigger QA retest on the target URL
   *   2. Wait for retest to complete
   *   3. Check if bug is fixed + quality meets threshold
   *   4. If fixed → mark verified, post success comment on PR
   *   5. If not fixed + iterations remain → generate improved fix, push new commit, repeat
   *   6. If max iterations reached → mark needs_review, post warning comment
   *   7. If quality decreased → mark regression, post warning comment
   */
  private async retestAndIterate(
    attemptId: string,
    bug: BugDetails,
    github: GitHubService,
    branchName: string,
    defaultBranch: string,
    prNumber: number,
    currentFiles: { path: string; content: string; sha: string }[],
    lastFixResult: { changes: FileChange[]; reasoning: string; diff: string },
    options: { maxIterations?: number; qualityThreshold?: number; workspaceId?: string; autoMerge?: boolean },
  ): Promise<void> {
    const maxIterations = options.maxIterations || 3;
    const qualityThreshold = options.qualityThreshold || 80;
    let iteration = 1;
    let previousFixResult = lastFixResult;

    while (iteration <= maxIterations) {
      try {
        // Mark as retesting
        await this.repository.updateAttempt(attemptId, {
          status: 'retesting',
          iteration_count: iteration,
        });

        logger.info('Starting retest iteration', {
          attemptId,
          iteration,
          maxIterations,
          bugId: bug.id,
        });

        // Post a comment on the PR
        await github.addPRComment(prNumber,
          `🔄 **Retest iteration ${iteration}/${maxIterations}** — Running QA Loop to verify fix...`
        ).catch(err => logger.warn('Failed to post retest comment', { error: err.message }));

        // Step 1: Trigger QA retest
        const retestResult = await this.triggerRetest(
          bug,
          attemptId,
          options.workspaceId
        );

        // Update quality score after retest
        await this.repository.updateAttempt(attemptId, {
          quality_score_after: retestResult.qualityScore,
          verification_session_id: retestResult.sessionId,
          verification_status: retestResult.status,
        });

        // Step 2: Check results
        if (retestResult.status === 'pass') {
          // Bug is fixed and quality meets threshold
          await this.repository.updateAttempt(attemptId, {
            status: 'verified',
            verification_status: 'pass',
          });

          await github.addPRComment(prNumber,
            `✅ **Bug verified fixed!** (iteration ${iteration}/${maxIterations})\n\n` +
            `- Quality score: **${retestResult.qualityScore}/100**\n` +
            `- Bug still exists: No\n` +
            `- New bugs found: ${retestResult.newBugsFound}\n\n` +
            `This PR is ready for review and merge.`
          ).catch(err => logger.warn('Failed to post success comment', { error: err.message }));

          logger.info('Auto-fix verified!', {
            attemptId,
            iteration,
            qualityScore: retestResult.qualityScore,
          });
          return; // Done!
        }

        if (retestResult.status === 'regression') {
          // Quality decreased — this fix made things worse
          await this.repository.updateAttempt(attemptId, {
            status: 'needs_review',
            verification_status: 'regression',
          });

          await github.addPRComment(prNumber,
            `❌ **Quality regression detected** (iteration ${iteration}/${maxIterations})\n\n` +
            `- Quality score: **${retestResult.qualityScore}/100** (decreased)\n` +
            `- Bug still exists: ${retestResult.bugStillExists ? 'Yes' : 'No'}\n` +
            `- New bugs found: ${retestResult.newBugsFound}\n\n` +
            `⚠️ The fix may have introduced new issues. Manual review required.`
          ).catch(err => logger.warn('Failed to post regression comment', { error: err.message }));

          logger.warn('Auto-fix caused regression', {
            attemptId,
            iteration,
            qualityScore: retestResult.qualityScore,
          });
          return;
        }

        // Step 3: Bug still exists or partial fix — iterate if possible
        if (iteration >= maxIterations) {
          // Max iterations reached
          await this.repository.updateAttempt(attemptId, {
            status: 'needs_review',
            verification_status: retestResult.status,
          });

          await github.addPRComment(prNumber,
            `⚠️ **Max iterations reached** (${iteration}/${maxIterations})\n\n` +
            `- Quality score: **${retestResult.qualityScore}/100** (threshold: ${qualityThreshold})\n` +
            `- Bug still exists: ${retestResult.bugStillExists ? 'Yes' : 'No'}\n` +
            `- New bugs found: ${retestResult.newBugsFound}\n\n` +
            `Manual review needed. The auto-fix was unable to fully resolve the bug in ${maxIterations} iterations.`
          ).catch(err => logger.warn('Failed to post max-iter comment', { error: err.message }));

          logger.info('Auto-fix max iterations reached', {
            attemptId,
            iteration,
            maxIterations,
          });
          return;
        }

        // Step 4: Generate improved fix with failure context
        logger.info('Bug not fixed, generating improved fix', {
          attemptId,
          iteration,
          qualityScore: retestResult.qualityScore,
        });

        await this.repository.updateAttempt(attemptId, { status: 'generating' });

        // Re-read files from the branch (they may have changed from previous commits)
        const updatedFiles = await this.readRepoFiles(github,
          previousFixResult.changes.map(c => c.path),
          branchName
        );

        // Generate improved fix with failure context
        const improvedFix = await this.generateImprovedFix(
          bug,
          updatedFiles.length > 0 ? updatedFiles : currentFiles,
          previousFixResult,
          retestResult,
          iteration,
        );

        if (!improvedFix.changes || improvedFix.changes.length === 0) {
          await this.repository.updateAttempt(attemptId, {
            status: 'needs_review',
            error_message: `Claude could not generate an improved fix on iteration ${iteration + 1}`,
          });

          await github.addPRComment(prNumber,
            `⚠️ **Unable to generate improved fix** (iteration ${iteration + 1}/${maxIterations})\n\n` +
            `Claude was unable to generate an improved fix. Manual review needed.`
          ).catch(err => logger.warn('Failed to post no-fix comment', { error: err.message }));
          return;
        }

        // Create a new branch for the improved fix (old branch was merged)
        const newBranchName = `autofix/bug-${bug.id.slice(0, 8)}-iter${iteration + 1}-${Date.now().toString(36)}`;
        await github.createBranch(newBranchName, defaultBranch);

        // Push improved fix to the new branch
        for (const change of improvedFix.changes) {
          await github.pushFixToExistingBranch(
            change.path,
            change.newContent,
            `fix: ${bug.title} (iteration ${iteration + 1})\n\nImproved fix based on retest feedback`,
            newBranchName,
          );
        }

        // Create a new PR for the improved fix
        const newPr = await github.createPullRequest({
          title: `[Auto-Fix] ${bug.title} (iteration ${iteration + 1})`,
          body: `## Improved Fix (Iteration ${iteration + 1})\n\n**Reasoning:** ${improvedFix.reasoning}\n\n**Files Changed:** ${improvedFix.changes.map(c => `\`${c.path}\``).join(', ')}\n\n---\n*Auto-generated by WhyNot QA*`,
          head: newBranchName,
          base: defaultBranch,
        });

        // Update attempt with new PR info
        await this.repository.updateAttempt(attemptId, {
          generated_diff: improvedFix.diff,
          claude_reasoning: improvedFix.reasoning,
          status: 'pr_created',
          branch_name: newBranchName,
          pr_number: newPr.number,
          pr_url: newPr.html_url,
        });

        // Auto-merge the new PR if enabled
        if (options.autoMerge) {
          await this.repository.updateAttempt(attemptId, { status: 'merging' as any });
          try {
            await github.mergePullRequest(newPr.number, `fix: ${bug.title} (iteration ${iteration + 1})\n\nAuto-merged by WhyNot QA`);
            logger.info('Auto-merged improved fix PR', { attemptId, prNumber: newPr.number, iteration: iteration + 1 });
          } catch (mergeError: any) {
            logger.warn('Failed to auto-merge improved fix PR', { error: mergeError.message });
            await this.repository.updateAttempt(attemptId, {
              status: 'needs_review',
              error_message: `Improved fix PR #${newPr.number} created but auto-merge failed: ${mergeError.message}`,
            });
            return;
          }
        }

        // Update tracking vars for next iteration
        branchName = newBranchName;
        prNumber = newPr.number;

        previousFixResult = improvedFix;
        iteration++;

      } catch (error: any) {
        logger.error('Retest iteration failed', {
          attemptId,
          iteration,
          error: error.message,
        });

        await this.repository.updateAttempt(attemptId, {
          status: 'failed',
          error_message: `Retest iteration ${iteration} failed: ${error.message}`,
        });

        await github.addPRComment(prNumber,
          `❌ **Retest iteration ${iteration} failed**\n\n` +
          `Error: ${error.message}\n\nManual review needed.`
        ).catch(err => logger.warn('Failed to post error comment', { error: err.message }));
        return;
      }
    }
  }

  // ─── Retest Trigger ────────────────────────────────────────────────────────

  /**
   * Trigger a QA Loop retest on the target URL and wait for results
   */
  private async triggerRetest(
    bug: BugDetails,
    attemptId: string,
    workspaceId?: string,
  ): Promise<RetestResult> {
    const targetUrl = bug.page_url || bug.website_url;
    if (!targetUrl) {
      throw new Error('No target URL available for retest');
    }

    // Start a new QA session focused on retesting
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (workspaceId) headers['X-Workspace-ID'] = workspaceId;

    const startResponse = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions`,
      {
        targetUrl,
        qualityThreshold: 80,
        maxIterations: 2, // Quick focused retest — keep short to avoid timeout
        workspaceId: workspaceId || null,
        documentContext: `RETEST MODE: Verify that the following bug has been fixed.\n\nBug: ${bug.title}\nDescription: ${bug.description}\nExpected: ${bug.expected_behavior || 'Normal behavior'}`,
      },
      { headers, timeout: 30_000 }
    );

    const sessionId = startResponse.data?.session?.id;
    if (!sessionId) {
      throw new Error('Failed to start retest session — no session ID returned');
    }

    // Update attempt with verification session
    await this.repository.updateAttempt(attemptId, {
      verification_session_id: sessionId,
    });

    logger.info('Retest session started', { attemptId, sessionId, targetUrl });

    // Poll for session completion (max 10 minutes)
    const maxPollTime = 10 * 60 * 1000; // 10 minutes
    const pollInterval = 15_000; // 15 seconds
    const startTime = Date.now();

    let sessionData: any = null;

    while (Date.now() - startTime < maxPollTime) {
      await this.sleep(pollInterval);

      try {
        const statusResponse = await axios.get(
          `${qaLoopExecutorUrl}/api/sessions/${sessionId}`,
          { headers, timeout: 10_000 }
        );

        sessionData = statusResponse.data?.session || statusResponse.data;
        const status = sessionData?.status;

        if (status === 'completed' || status === 'stopped' || status === 'failed') {
          break;
        }

        logger.debug('Retest still running', {
          attemptId,
          sessionId,
          status,
          elapsed: Math.round((Date.now() - startTime) / 1000),
        });
      } catch (error: any) {
        logger.warn('Failed to poll retest session', {
          sessionId,
          error: error.message,
        });
      }
    }

    if (!sessionData || !['completed', 'stopped'].includes(sessionData.status)) {
      throw new Error(`Retest session did not complete within timeout (status: ${sessionData?.status || 'unknown'})`);
    }

    // Analyze retest results
    const qualityScore = sessionData.quality_score || 0;
    const bugsFound = sessionData.bugs_found || 0;

    // Check if the specific original bug still exists in the retest results
    let bugStillExists = false;
    try {
      const bugsResponse = await axios.get(
        `${qaLoopExecutorUrl}/api/sessions/${sessionId}/bugs`,
        { headers, timeout: 10_000 }
      );

      const retestBugs = bugsResponse.data?.bugs || bugsResponse.data || [];
      // Check for bugs with similar titles or descriptions
      bugStillExists = retestBugs.some((b: any) =>
        this.isSimilarBug(bug, b)
      );
    } catch (error: any) {
      logger.warn('Failed to fetch retest bugs', { sessionId, error: error.message });
    }

    // Get the quality score before fix for comparison
    const attempt = await this.repository.findAttemptById(attemptId);
    const scoreBefore = attempt?.quality_score_before || 0;

    // Determine verification status
    let status: RetestResult['status'];
    if (!bugStillExists && qualityScore >= (scoreBefore || 80)) {
      status = 'pass';
    } else if (qualityScore < scoreBefore - 10) {
      // Quality dropped by more than 10 points — regression
      status = 'regression';
    } else if (!bugStillExists) {
      status = 'partial'; // Bug fixed but quality didn't meet threshold
    } else {
      status = 'fail';
    }

    return {
      sessionId,
      qualityScore,
      bugStillExists,
      newBugsFound: bugsFound,
      status,
    };
  }

  /**
   * Check if two bugs are similar (fuzzy match on title/description)
   */
  private isSimilarBug(original: BugDetails, candidate: any): boolean {
    const origTitle = (original.title || '').toLowerCase();
    const candTitle = (candidate.title || '').toLowerCase();

    // Direct title match
    if (origTitle === candTitle) return true;

    // Significant word overlap
    const origWords = origTitle.split(/\s+/).filter((w: string) => w.length > 3);
    const candWords = candTitle.split(/\s+/).filter((w: string) => w.length > 3);
    const overlap = origWords.filter((w: string) => candWords.includes(w)).length;

    if (origWords.length > 0 && overlap / origWords.length >= 0.5) return true;

    // Same category + similar page
    if (original.category === candidate.category && original.page_url === candidate.page_url) {
      return true;
    }

    return false;
  }

  // ─── File Reading Helper ───────────────────────────────────────────────────

  /**
   * Read multiple files from the repo with a total size limit
   */
  private async readRepoFiles(
    github: GitHubService,
    paths: string[],
    ref: string,
    maxTotalSize = 50000,
  ): Promise<{ path: string; content: string; sha: string }[]> {
    const fileContents: { path: string; content: string; sha: string }[] = [];
    let totalSize = 0;

    for (const filePath of paths) {
      if (totalSize >= maxTotalSize) break;
      try {
        const file = await github.getFileContent(filePath, ref);
        if (totalSize + file.content.length <= maxTotalSize) {
          fileContents.push({ path: filePath, content: file.content, sha: file.sha });
          totalSize += file.content.length;
        }
      } catch (error: any) {
        logger.warn('Failed to read file', { path: filePath, error: error.message });
      }
    }

    return fileContents;
  }

  // ─── Fix Generation ────────────────────────────────────────────────────────

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

    return this.callClaudeForFix(prompt, files);
  }

  /**
   * Generate an improved fix based on retest failure context
   */
  private async generateImprovedFix(
    bug: BugDetails,
    files: { path: string; content: string; sha: string }[],
    previousFix: { changes: FileChange[]; reasoning: string; diff: string },
    retestResult: RetestResult,
    iteration: number,
  ): Promise<{
    changes: FileChange[];
    reasoning: string;
    diff: string;
  }> {
    const filesContext = files.map(f =>
      `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
    ).join('\n\n');

    const previousChanges = previousFix.changes.map(c =>
      `- \`${c.path}\`: Modified`
    ).join('\n');

    const prompt = `You are an expert software engineer. A previous auto-fix attempt for a bug did NOT fully resolve the issue. You need to analyze what went wrong and generate an improved fix.

## Bug Report

**Title:** ${bug.title}
**Severity:** ${bug.severity}
**Description:** ${bug.description || 'No description'}
**Expected Behavior:** ${bug.expected_behavior || 'Not specified'}
**Actual Behavior:** ${bug.actual_behavior || 'Not specified'}

## Previous Fix Attempt (Iteration ${iteration})

**Previous Reasoning:** ${previousFix.reasoning}

**Files Changed:**
${previousChanges}

## Retest Results

- Bug still exists: ${retestResult.bugStillExists ? 'YES' : 'No'}
- Quality score: ${retestResult.qualityScore}/100
- New bugs found: ${retestResult.newBugsFound}
- Verification status: ${retestResult.status}

## Current Source Code (with previous fix applied)

${filesContext}

## Instructions

The previous fix attempt was NOT sufficient. Please:

1. Analyze WHY the previous fix didn't fully resolve the bug
2. Consider whether the approach was wrong or just incomplete
3. Generate an IMPROVED fix that addresses the root cause more thoroughly

Respond with a JSON object in this exact format:
{
  "reasoning": "Explain why the previous fix failed and how this improved fix addresses the issue",
  "changes": [
    {
      "path": "path/to/file.ts",
      "content": "FULL new content of the file with the improved fix applied"
    }
  ]
}

IMPORTANT:
- Each "content" field must contain the COMPLETE file content (not a diff)
- Only modify files that need changes
- Make minimal, focused changes — but be more thorough than the previous attempt
- Consider edge cases the previous fix may have missed
- Return ONLY the JSON object, no other text`;

    return this.callClaudeForFix(prompt, files);
  }

  /**
   * Shared Claude API call for fix generation
   */
  private async callClaudeForFix(
    prompt: string,
    files: { path: string; content: string; sha: string }[]
  ): Promise<{
    changes: FileChange[];
    reasoning: string;
    diff: string;
  }> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: 'You are an expert software engineer. You MUST respond with ONLY a valid JSON object. No markdown, no explanation text before or after the JSON. Just the raw JSON object starting with { and ending with }.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    // Parse the JSON response - try multiple extraction strategies
    let parsed: any;
    try {
      // Strategy 1: Try parsing the full text directly
      parsed = JSON.parse(textContent.trim());
    } catch {
      try {
        // Strategy 2: Extract JSON from markdown code block
        const codeBlockMatch = textContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          parsed = JSON.parse(codeBlockMatch[1].trim());
        } else {
          // Strategy 3: Find the outermost JSON object with brace matching
          const startIdx = textContent.indexOf('{');
          if (startIdx === -1) {
            throw new Error('No JSON found in Claude response');
          }
          let depth = 0;
          let endIdx = -1;
          let inString = false;
          let escapeNext = false;
          for (let i = startIdx; i < textContent.length; i++) {
            const ch = textContent[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (ch === '\\' && inString) { escapeNext = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
          }
          if (endIdx === -1) throw new Error('No complete JSON object found in Claude response');
          parsed = JSON.parse(textContent.substring(startIdx, endIdx + 1));
        }
      } catch (parseError: any) {
        logger.error('Failed to parse Claude fix response', {
          error: parseError.message,
          response: textContent.substring(0, 1000),
        });
        throw new Error(`Failed to parse fix: ${parseError.message}`);
      }
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

  // ─── PR Description Builder ────────────────────────────────────────────────

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
*This PR was automatically generated by [WhyNot QA](https://whynot.dev) — Autonomous Testing Platform*
*🔄 Auto-fix loop: Find bug → Fix code → Create PR → Retest → Iterate until quality target met*
*Please review the changes carefully before merging.*`;
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── GitHub Repos CRUD ─────────────────────────────────────────────────────

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
