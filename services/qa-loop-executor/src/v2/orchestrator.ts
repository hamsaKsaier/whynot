/**
 * V2 Orchestrator — manages the multi-agent QA team lifecycle.
 *
 * Flow:
 * 1. Start MCP browser, perform login if credentials provided
 * 2. QA Lead creates session plan (one AI call)
 * 3. Exploratory Tester runs (no dependencies)
 * 4. (Week 3) Security + API Testers run when Exploratory has discoveries
 * 5. (Week 4) QA Lead synthesizes final report
 *
 * Triggered by scan_mode='v2'. V1 remains the default.
 */
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';
import { emitToSession } from '../api/websocket';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { MCPBrowser } from '../mcp-browser';
import { LoopConfig } from '../loop-orchestrator';
import { SessionPlanStore } from './session-plan';
import { AgentBoard } from './agent-board';
import { AgentType, AgentConfig, AgentResult, SessionPlan, PlanObjective } from './types';
import { QALeadAgent } from './agents/qa-lead';
import { ExploratoryTesterAgent } from './agents/exploratory-tester';
import { SecurityTesterAgent } from './agents/security-tester';
import { APITesterAgent } from './agents/api-tester';
import { AutoTesterAgent } from './agents/auto-tester';

const logger = createLogger('v2-orchestrator');

export class V2Orchestrator {
  private sessionId: string;
  private config: LoopConfig;
  private repository: QALoopRepository;
  private planStore: SessionPlanStore;
  private board: AgentBoard;
  private mcpBrowser: MCPBrowser | null = null;
  // Fix D: iteration counter for persisting cost per agent into qa_loop_iterations
  private iterationCounter = 0;
  // Demo-fix: user-initiated cancellation support. The pause/stop HTTP
  // routes call stop() → sets the flag and aborts the in-flight LLM call
  // on whichever agent is currently running, unwinding the scan cleanly.
  private stopRequested = false;
  private currentAgentAbort: AbortController | null = null;

  constructor(sessionId: string, config: LoopConfig) {
    this.sessionId = sessionId;
    this.config = config;
    this.repository = new QALoopRepository();
    this.planStore = new SessionPlanStore();
    this.board = new AgentBoard();
  }

  /**
   * Request a clean stop of the running scan. Called by the pause and stop
   * HTTP routes. V2 does not have a real pause/resume model — both user
   * actions end the scan and persist whatever has been discovered so far.
   */
  async stop(): Promise<void> {
    if (this.stopRequested) return;
    this.stopRequested = true;
    logger.info('V2 stop requested', { sessionId: this.sessionId });
    // Abort the currently running agent's in-flight LLM call.
    try { this.currentAgentAbort?.abort(); } catch {}
    // Force-stop the MCP browser so any active tool calls fail fast.
    try { await this.mcpBrowser?.stop(); } catch {}
    emitToSession(this.sessionId, {
      type: 'status_update',
      data: { status: 'cancelled', message: 'Scan stopped by user' },
    });
  }

  isStopRequested(): boolean {
    return this.stopRequested;
  }

  /**
   * Main entry point. Runs the full multi-agent session.
   */
  async run(): Promise<void> {
    const startTime = Date.now();

    try {
      // Mark session as running
      await this.repository.updateSessionStatus(this.sessionId, 'running');

      logger.info('V2 multi-agent session starting', {
        sessionId: this.sessionId,
        targetUrl: this.config.targetUrl,
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'planning', message: 'QA Lead analyzing app and creating test plan...' },
      });

      // ─── Phase 1: Start browser + login ────────────────────────
      this.mcpBrowser = new MCPBrowser(this.sessionId);
      await this.mcpBrowser.start();
      logger.info('MCP Browser launched for v2 session', { sessionId: this.sessionId });

      if (this.config.loginCredentials) {
        await this.performLogin();
      }

      // ─── Phase 2: QA Lead creates session plan ─────────────────
      const plan = await this.createSessionPlan();

      if (!plan) {
        throw new Error('QA Lead failed to create session plan');
      }

      logger.info('Session plan created', {
        sessionId: this.sessionId,
        objectives: plan.objectives.length,
        appType: plan.app_analysis.app_type,
      });

      // Emit plan_ready so frontend can show the plan
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          phase: 'plan_ready',
          message: `Plan ready: ${plan.objectives.length} objectives for ${plan.app_analysis.app_type} app`,
          plan: {
            app_analysis: plan.app_analysis,
            objectives: plan.objectives,
            agents: [...new Set(plan.objectives.map(o => o.agent))],
          },
        },
      });

      // ─── Phase 3: Run Exploratory Tester ───────────────────────
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'exploration', message: 'Exploratory Tester starting browser exploration...' },
      });

      const exploratoryResult = await this.runExploratoryTester(plan);

      logger.info('Exploratory Tester completed', {
        sessionId: this.sessionId,
        pages: exploratoryResult.pagesExplored,
        tests: exploratoryResult.testsGenerated,
        bugs: exploratoryResult.bugsFound,
        status: exploratoryResult.status,
      });

      // ─── Phase 4: Security + API Testers (sequential, same browser) ─
      const allResults: AgentResult[] = [exploratoryResult];

      // Security Tester — reads forms from board, tests XSS/SQLi/CSRF
      if (!this.stopRequested) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: { phase: 'security', message: 'Security Tester testing forms for vulnerabilities...' },
        });

        const securityResult = await this.runAgent('security', plan);
        allResults.push(securityResult);

        logger.info('Security Tester completed', {
          sessionId: this.sessionId,
          bugs: securityResult.bugsFound,
          status: securityResult.status,
        });
      }

      // API Tester — reads endpoints from board, tests edge cases via fetch()
      if (!this.stopRequested) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: { phase: 'api_testing', message: 'API Tester testing endpoints for edge cases...' },
        });

        const apiResult = await this.runAgent('api_tester', plan);
        allResults.push(apiResult);

        logger.info('API Tester completed', {
          sessionId: this.sessionId,
          bugs: apiResult.bugsFound,
          endpoints: apiResult.apiEndpointsTested,
          status: apiResult.status,
        });
      }

      // ─── Phase 5: Auto Tester (runs last, no browser needed) ──
      if (!this.stopRequested) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: { phase: 'auto_testing', message: 'Auto Tester generating Playwright regression tests...' },
        });

        const autoResult = await this.runAgent('auto_tester', plan);
        allResults.push(autoResult);

        logger.info('Auto Tester completed', {
          sessionId: this.sessionId,
          tests: autoResult.testsGenerated,
          status: autoResult.status,
        });
      }

      // ─── Phase 6: QA Lead synthesis ─────────────────────────────
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'synthesis', message: 'QA Lead synthesizing final report...' },
      });

      const report = await this.synthesizeReport(plan, allResults);

      // Store report in session
      await query(
        'UPDATE qa_loop_sessions SET report_data = $1, quality_score = $2 WHERE id = $3',
        [JSON.stringify(report), report.quality_score, this.sessionId]
      );

      logger.info('QA Lead synthesis complete', {
        sessionId: this.sessionId,
        qualityScore: report.quality_score,
        clusters: report.critical_clusters.length,
        recommendations: report.recommendations.length,
      });

      // ─── Phase 7: Update project memory ───────────────────────
      await this.updateProjectMemory(allResults).catch(err => {
        logger.error('Project memory update failed (non-fatal)', { error: err.message });
      });

      // ─── Phase 8: Update session with aggregate results ───────
      const totalTests = allResults.reduce((s, r) => s + r.testsGenerated, 0);
      const totalBugs = allResults.reduce((s, r) => s + r.bugsFound, 0);
      const totalPages = allResults.reduce((s, r) => s + r.pagesExplored, 0);

      await this.repository.updateSessionProgress(this.sessionId, {
        testsGenerated: totalTests,
        bugsFound: totalBugs,
        pagesExplored: totalPages,
      });

      await this.repository.updateSessionStatus(this.sessionId, 'completed');

      const durationMin = Math.round((Date.now() - startTime) / 60000);

      emitToSession(this.sessionId, {
        type: 'session_complete',
        data: {
          testsGenerated: totalTests,
          bugsFound: totalBugs,
          pagesExplored: totalPages,
          durationMin,
          qualityScore: report.quality_score,
          report,
          agents: allResults.map(r => ({
            agent: r.agentType,
            status: r.status,
            tests: r.testsGenerated,
            bugs: r.bugsFound,
            pages: r.pagesExplored,
            apiEndpoints: r.apiEndpointsTested,
          })),
        },
      });

      logger.info('V2 multi-agent session completed', {
        sessionId: this.sessionId,
        durationMin,
        totalTests,
        totalBugs,
        totalPages,
      });

    } catch (err: any) {
      logger.error('V2 orchestrator failed', {
        sessionId: this.sessionId,
        error: err.message,
        stack: err.stack?.slice(0, 500),
      });

      await this.repository.updateSessionStatus(this.sessionId, 'failed', err.message).catch(() => {});

      emitToSession(this.sessionId, {
        type: 'error',
        data: { message: `Multi-agent session failed: ${err.message}` },
      });

    } finally {
      if (this.mcpBrowser) {
        await this.mcpBrowser.forceStop().catch(() => {});
      }
    }
  }

  /**
   * QA Lead makes one AI call to produce the session plan.
   */
  private async createSessionPlan(): Promise<SessionPlan | null> {
    const qaLead = new QALeadAgent({
      sessionId: this.sessionId,
      agentType: 'qa_lead',
      targetUrl: this.config.targetUrl,
      plan: null as any,
      projectContext: this.config.projectContext,
      loginCredentials: this.config.loginCredentials,
    });

    const planData = await qaLead.createPlan();
    if (!planData) return null;

    // Fix D: persist QA Lead planning iteration
    if (qaLead.lastPlanUsage) {
      this.iterationCounter++;
      await this.persistIteration('qa_lead_plan', qaLead.lastPlanUsage, {
        completionReason: 'plan_created',
      }).catch(() => {});
    }

    // Store in database
    const plan = await this.planStore.create(
      this.sessionId,
      planData.app_analysis,
      planData.objectives
    );

    return plan;
  }

  /**
   * Fix D helper: persist a single QA Lead iteration to qa_loop_iterations.
   */
  private async persistIteration(
    focusArea: string,
    usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number; costCents: number; modelId: string; durationMs: number },
    extra: { completionReason?: string; errorMessage?: string } = {},
  ): Promise<void> {
    try {
      await this.repository.addIteration(this.sessionId, {
        iterationNumber: this.iterationCounter,
        focusArea,
        pagesExplored: 0,
        testsGenerated: 0,
        bugsFound: 0,
        toolCalls: 0,
        tokensUsed: usage.inputTokens + usage.outputTokens,
        costUsd: usage.costCents / 100,
        durationMs: usage.durationMs,
        completionReason: extra.completionReason,
        errorMessage: extra.errorMessage,
        modelUsed: usage.modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costCents: usage.costCents,
      });
      logger.info('Persisted QA Lead iteration', {
        sessionId: this.sessionId,
        focusArea,
        iterationNumber: this.iterationCounter,
        costCents: usage.costCents,
      });
    } catch (err: any) {
      logger.error('Failed to persist QA Lead iteration (non-fatal)', {
        sessionId: this.sessionId,
        focusArea,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Run the Exploratory Tester agent.
   */
  private async runExploratoryTester(plan: SessionPlan): Promise<AgentResult> {
    return this.runAgent('exploratory', plan);
  }

  /**
   * Run any agent by type. Instantiates the correct agent class,
   * passes the shared browser (except Auto Tester which doesn't need it).
   *
   * CRITICAL: The same MCPBrowser instance is reused across all browser-using
   * agents (Exploratory, Security, API) so cookies / auth state persist.
   * If the browser died mid-session, we restart it here before the next agent.
   */
  private async runAgent(agentType: AgentType, plan: SessionPlan): Promise<AgentResult> {
    const agentConfig: AgentConfig = {
      sessionId: this.sessionId,
      agentType,
      targetUrl: this.config.targetUrl,
      plan,
      projectContext: this.config.projectContext,
      loginCredentials: this.config.loginCredentials,
    };

    // Browser-using agents: verify the shared browser is still alive, restart if not
    const needsBrowser = agentType !== 'auto_tester' && agentType !== 'qa_lead';
    if (needsBrowser) {
      if (!this.mcpBrowser || !this.mcpBrowser.connected) {
        logger.warn(`MCP browser not connected for ${agentType} — restarting`, {
          sessionId: this.sessionId,
        });
        this.mcpBrowser = new MCPBrowser(this.sessionId);
        await this.mcpBrowser.start();
        if (this.config.loginCredentials) {
          await this.performLogin();
        }
      } else {
        logger.info(`Reusing existing MCP browser for ${agentType}`, {
          sessionId: this.sessionId,
        });
      }
    }

    emitToSession(this.sessionId, {
      type: 'status_update',
      data: { agent: agentType, status: 'starting', message: `${agentType} agent starting...` },
    });

    let agent: { run(): Promise<AgentResult> };

    switch (agentType) {
      case 'exploratory':
        agent = new ExploratoryTesterAgent(agentConfig, this.mcpBrowser!);
        break;
      case 'security':
        agent = new SecurityTesterAgent(agentConfig, this.mcpBrowser!);
        break;
      case 'api_tester':
        agent = new APITesterAgent(agentConfig, this.mcpBrowser!);
        break;
      case 'auto_tester':
        // Auto Tester does NOT use the browser — only generates code
        agent = new AutoTesterAgent(agentConfig);
        break;
      default:
        logger.warn(`Unknown agent type: ${agentType}, skipping`);
        return {
          agentType,
          status: 'error',
          pagesExplored: 0,
          testsGenerated: 0,
          bugsFound: 0,
          apiEndpointsTested: 0,
          error: `Unknown agent type: ${agentType}`,
        };
    }

    const result = await agent.run();

    // Fix D: persist per-agent cost + usage to qa_loop_iterations
    // so v2 sessions have the same cost visibility as v1.
    this.iterationCounter++;
    try {
      const costCents = result.costCents || 0;
      await this.repository.addIteration(this.sessionId, {
        iterationNumber: this.iterationCounter,
        focusArea: agentType,
        pagesExplored: result.pagesExplored,
        testsGenerated: result.testsGenerated,
        bugsFound: result.bugsFound,
        toolCalls: result.toolCallCount || 0,
        tokensUsed: (result.inputTokens || 0) + (result.outputTokens || 0),
        costUsd: (costCents / 100),
        durationMs: result.durationMs,
        completionReason: result.completionReason,
        errorMessage: result.error,
        modelUsed: result.modelUsed,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        costCents,
      });
      logger.info('Persisted agent iteration', {
        sessionId: this.sessionId,
        agent: agentType,
        iterationNumber: this.iterationCounter,
        costCents,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
    } catch (persistErr: any) {
      logger.error('Failed to persist agent iteration (non-fatal)', {
        sessionId: this.sessionId,
        agent: agentType,
        error: persistErr.message,
      });
    }

    emitToSession(this.sessionId, {
      type: 'status_update',
      data: {
        agent: agentType,
        status: result.status,
        message: `${agentType} finished: ${result.testsGenerated} tests, ${result.bugsFound} bugs`,
        summary: result,
      },
    });

    return result;
  }

  /**
   * Perform login using credentials.
   */
  private async performLogin(): Promise<void> {
    if (!this.mcpBrowser || !this.config.loginCredentials) return;

    const creds = this.config.loginCredentials;
    const loginUrl = creds.loginUrl || this.config.targetUrl;

    logger.info('Performing login for v2 session', { sessionId: this.sessionId, loginUrl });

    await this.mcpBrowser.callTool('browser_navigate', { url: loginUrl });
    await new Promise(r => setTimeout(r, 2000));

    if (creds.emailSelector) {
      await this.mcpBrowser.callTool('browser_fill', {
        selector: creds.emailSelector,
        value: creds.email,
      });
    }
    if (creds.passwordSelector) {
      await this.mcpBrowser.callTool('browser_fill', {
        selector: creds.passwordSelector,
        value: creds.password,
      });
    }
    if (creds.submitSelector) {
      await this.mcpBrowser.callTool('browser_click', {
        selector: creds.submitSelector,
      });
    }

    await new Promise(r => setTimeout(r, 3000));
    await this.mcpBrowser.callTool('browser_navigate', { url: this.config.targetUrl });

    logger.info('Login completed for v2 session', { sessionId: this.sessionId });
  }

  /**
   * QA Lead synthesis — cross-references all agent findings.
   */
  private async synthesizeReport(plan: SessionPlan, agentResults: AgentResult[]): Promise<any> {
    const { QALeadAgent: QALead } = await import('./agents/qa-lead');

    const qaLead = new QALead({
      sessionId: this.sessionId,
      agentType: 'qa_lead',
      targetUrl: this.config.targetUrl,
      plan,
      projectContext: this.config.projectContext,
    });

    // Gather all data for synthesis
    const boardEntries = await this.board.getAllForSession(this.sessionId);
    const bugs = await this.repository.getBugs(this.sessionId).catch(() => []);
    const testCases = await this.repository.getTestCases(this.sessionId).catch(() => []);
    const pages = await this.repository.getExploredPages(this.sessionId).catch(() => []);

    const report = await qaLead.synthesize(agentResults, boardEntries, bugs, testCases, pages);

    // Fix D: persist QA Lead synthesis iteration
    if (qaLead.lastSynthesisUsage) {
      this.iterationCounter++;
      await this.persistIteration('qa_lead_synthesis', qaLead.lastSynthesisUsage, {
        completionReason: 'synthesis_complete',
      }).catch(() => {});
    }

    return report;
  }

  /**
   * Update project memory with findings from this scan.
   * Atomic: read current context → merge → write back.
   */
  private async updateProjectMemory(agentResults: AgentResult[]): Promise<void> {
    // Get the project ID from the session
    const session = await this.repository.getSession(this.sessionId);
    if (!session?.project_id) {
      logger.info('No project ID — skipping memory update', { sessionId: this.sessionId });
      return;
    }

    const projectId = session.project_id;

    // Read current project context
    const { context: currentCtx } = await this.repository.getProjectContext(projectId);
    const ctx = currentCtx || {};

    // Gather new data from this session
    const pages = await this.repository.getExploredPages(this.sessionId).catch(() => []);
    const bugs = await this.repository.getBugs(this.sessionId).catch(() => []);
    const testCases = await this.repository.getTestCases(this.sessionId).catch(() => []);
    const boardEntries = await this.board.getAllForSession(this.sessionId);

    // Merge pages into known_pages (dedup by URL)
    const knownPages: any[] = ctx.known_pages || [];
    const existingUrls = new Set(knownPages.map((p: any) => p.url));
    for (const page of pages) {
      if (!existingUrls.has(page.url)) {
        knownPages.push({
          url: page.url,
          explored: page.is_explored,
          page_type: page.page_type,
          discovered_by: page.discovered_by || 'exploratory',
        });
        existingUrls.add(page.url);
      }
    }

    // Merge bugs into known_bugs (dedup by title)
    const knownBugs: any[] = ctx.known_bugs || [];
    const existingBugTitles = new Set(knownBugs.map((b: any) => b.title));
    for (const bug of bugs) {
      if (!existingBugTitles.has(bug.title)) {
        knownBugs.push({
          title: bug.title,
          severity: bug.severity,
          status: bug.status || 'open',
          page_url: bug.page_url,
          agent_source: bug.agent_source,
          bug_type: bug.bug_type,
        });
        existingBugTitles.add(bug.title);
      }
    }

    // Merge test coverage
    const testCoverage: any[] = ctx.test_coverage || [];
    const existingTestNames = new Set(testCoverage.map((t: any) => t.name));
    for (const tc of testCases) {
      if (!existingTestNames.has(tc.name)) {
        testCoverage.push({
          name: tc.name,
          test_case_id: tc.id,
          status: tc.last_run_status || 'pending',
          page_url: tc.source_page_url,
          agent_source: tc.agent_source,
        });
        existingTestNames.add(tc.name);
      }
    }

    // Extract new API endpoints and security issues from board
    const apiEndpoints: any[] = ctx.known_api_endpoints || [];
    const securityIssues: any[] = ctx.known_security_issues || [];
    for (const entry of boardEntries) {
      const discoveries = Array.isArray(entry.discoveries) ? entry.discoveries : [];
      for (const d of discoveries) {
        if (d.type === 'api_endpoint' && d.path) {
          const key = `${d.method || 'GET'} ${d.path}`;
          if (!apiEndpoints.some((e: any) => `${e.method} ${e.path}` === key)) {
            apiEndpoints.push({ method: d.method || 'GET', path: d.path, auth_required: d.auth_required });
          }
        }
        if (d.type === 'security_issue' && d.title) {
          if (!securityIssues.some((i: any) => i.title === d.title)) {
            securityIssues.push({ type: d.bug_type || 'unknown', title: d.title, page: d.page, status: 'open' });
          }
        }
      }
    }

    // Update scan history
    const scanHistory: any[] = (ctx.scan_history || []).slice(-19); // Keep last 20
    scanHistory.push({
      session_id: this.sessionId,
      scan_mode: 'v2',
      date: new Date().toISOString(),
      pages: pages.length,
      bugs: bugs.length,
      tests: testCases.length,
      agents: agentResults.map(r => r.agentType),
    });

    // Build updated context
    const updatedCtx = {
      ...ctx,
      known_pages: knownPages,
      known_bugs: knownBugs,
      test_coverage: testCoverage,
      known_api_endpoints: apiEndpoints,
      known_security_issues: securityIssues,
      scan_history: scanHistory,
      total_scans: (ctx.total_scans || 0) + 1,
      last_scan_at: new Date().toISOString(),
    };

    // Write back atomically
    await query(
      'UPDATE projects SET context = $1 WHERE id = $2',
      [JSON.stringify(updatedCtx), projectId]
    );

    logger.info('Project memory updated', {
      sessionId: this.sessionId,
      projectId,
      pages: knownPages.length,
      bugs: knownBugs.length,
      tests: testCoverage.length,
      apiEndpoints: apiEndpoints.length,
    });
  }
}
