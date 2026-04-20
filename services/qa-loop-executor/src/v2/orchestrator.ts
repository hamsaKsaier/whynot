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
import { ChromeDevToolsMCP } from '../chrome-devtools-mcp';
import { LoopConfig } from '../loop-orchestrator';
import { ParallelTestExecutor } from '../parallel-test-executor';
import { SessionPlanStore } from './session-plan';
import { AgentBoard } from './agent-board';
import { AgentType, AgentConfig, AgentResult, SessionPlan, PlanObjective } from './types';
import { QALeadAgent } from './agents/qa-lead';
import { ExploratoryTesterAgent } from './agents/exploratory-tester';
import { SecurityTesterAgent } from './agents/security-tester';
import { APITesterAgent } from './agents/api-tester';
import { AutoTesterAgent } from './agents/auto-tester';
import { BaseAgent } from './agents/base-agent';

const logger = createLogger('v2-orchestrator');

// ─── Cost circuit breaker constants ─────────────────────────────────────
// Hard cap: $5.00 estimated REAL Anthropic cost per session.
// Our DB-tracked cost (from result.usage tokens) consistently under-reports
// actual Anthropic bill by ~5× because the AI SDK doesn't always surface
// cache creation tokens. We multiply DB-tracked cost by this factor before
// comparing to the cap so we stop BEFORE we blow the real-cost budget.
const MAX_SESSION_COST_CENTS = 500;       // $5.00 real cost cap
const COST_UNDERCOUNT_FACTOR = 5;         // Real cost ≈ DB-tracked × 5

// ─── Priority 1: agent idle watchdog ────────────────────────────────────
// If an agent makes no progress (no LLM call, no tool call step, no status
// emission) for longer than this many minutes, the orchestrator aborts the
// agent via AbortController, marks its result status as 'killed_idle',
// and continues to the next agent. Tuned default of 10 min covers slow
// MCP browser ops + model latency spikes without letting a stuck agent
// hold the whole scan hostage for hours.
const MAX_AGENT_IDLE_MIN = parseInt(process.env.MAX_AGENT_IDLE_MIN || '10', 10);
// How often the watchdog polls the agent's lastActivityAt. Needs to be
// shorter than MAX_AGENT_IDLE_MIN so we detect hangs promptly but long
// enough to avoid spinning — 30s strikes the right balance.
const WATCHDOG_POLL_MS = 30_000;

export class V2Orchestrator {
  private sessionId: string;
  private config: LoopConfig;
  private repository: QALoopRepository;
  private planStore: SessionPlanStore;
  private board: AgentBoard;
  private mcpBrowser: MCPBrowser | null = null;
  // Week 2: Chrome DevTools MCP runs alongside MCPBrowser for diagnostics
  // (console messages, network requests, a11y tree, lighthouse). Uses its
  // OWN Chromium instance — see chrome-devtools-mcp.ts header for the
  // Option A-vs-B tradeoff and why we picked Option B.
  private cdpMcp: ChromeDevToolsMCP | null = null;
  // Fix D: iteration counter for persisting cost per agent into qa_loop_iterations
  private iterationCounter = 0;
  // Demo-fix: user-initiated cancellation support. The pause/stop HTTP
  // routes call stop() → sets the flag and aborts the in-flight LLM call
  // on whichever agent is currently running, unwinding the scan cleanly.
  private stopRequested = false;
  private currentAgentAbort: AbortController | null = null;
  // Fix 3: cumulative tracked cost across all agents for the circuit breaker
  private cumulativeCostCents = 0;
  private circuitBreakerTripped = false;

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

      // Week 2: start Chrome DevTools MCP in parallel. Non-fatal — if it
      // fails to start (e.g. npx cache cold), the scan still runs without
      // CDP diagnostics and agents fall back to the Playwright-only path.
      try {
        this.cdpMcp = new ChromeDevToolsMCP(this.sessionId);
        await this.cdpMcp.start();
        logger.info('Chrome DevTools MCP launched for v2 session', {
          sessionId: this.sessionId,
          toolCount: this.cdpMcp.getTools().length,
        });
      } catch (cdpErr: any) {
        logger.warn('Chrome DevTools MCP failed to start — continuing without diagnostics', {
          sessionId: this.sessionId,
          error: cdpErr.message,
        });
        this.cdpMcp = null;
      }

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
      this.accumulateCost(exploratoryResult);

      // Security Tester — reads forms from board, tests XSS/SQLi/CSRF
      if (!this.stopRequested && !this.costBudgetExceeded()) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: { phase: 'security', message: 'Security Tester testing forms for vulnerabilities...' },
        });
        const securityResult = await this.runAgent('security', plan);
        allResults.push(securityResult);
        this.accumulateCost(securityResult);
        logger.info('Security Tester completed', {
          sessionId: this.sessionId,
          bugs: securityResult.bugsFound,
          status: securityResult.status,
        });
      }

      // API Tester — reads endpoints from board, tests edge cases via fetch()
      if (!this.stopRequested && !this.costBudgetExceeded()) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: { phase: 'api_testing', message: 'API Tester testing endpoints for edge cases...' },
        });
        const apiResult = await this.runAgent('api_tester', plan);
        allResults.push(apiResult);
        this.accumulateCost(apiResult);
        logger.info('API Tester completed', {
          sessionId: this.sessionId,
          bugs: apiResult.bugsFound,
          endpoints: apiResult.apiEndpointsTested,
          status: apiResult.status,
        });
      }

      // ─── Phase 5: Auto Tester (runs last, no browser needed) ──
      if (!this.stopRequested && !this.costBudgetExceeded()) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: { phase: 'auto_testing', message: 'Auto Tester generating Playwright regression tests...' },
        });
        const autoResult = await this.runAgent('auto_tester', plan);
        allResults.push(autoResult);
        this.accumulateCost(autoResult);
        logger.info('Auto Tester completed', {
          sessionId: this.sessionId,
          tests: autoResult.testsGenerated,
          status: autoResult.status,
        });
      }

      // ─── Phase 5.5: Execute generated test cases ────────────────
      // Before synthesis, run every test case saved by Auto Tester through
      // the test-executor so last_run_status gets populated. Pass/fail
      // counts are passed to QA Lead for the synthesis report.
      const execSummary = await this.executeGeneratedTests();

      // ─── Phase 6: QA Lead synthesis ─────────────────────────────
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'synthesis', message: 'QA Lead synthesizing final report...' },
      });

      const report = await this.synthesizeReport(plan, allResults);

      // Attach execution summary to the report so frontend can display pass/fail
      if (execSummary) {
        (report as any).test_execution = execSummary;
      }

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

<<<<<<< HEAD
      // ─── Compression baseline summary (Part 1 + Part 2 instrumentation) ────
      // Aggregate token + cost totals across every agent in this session.
      //
      // Task 1: separate LLM calls (generateText invocations) from TOOL calls
      //   (individual tool-call steps). Previous aggregator mislabeled
      //   toolCallCount as "apiCalls", inflating the headline number ~30×.
      // Task 2: average char-based composition across every LLM call so we
      //   can see WHERE input tokens are going (system / history / context / tools).
      // Task 3: expose the single biggest LLM call + which agent produced it.
      const costSummary = allResults.reduce(
        (acc, r) => ({
          llmCalls: acc.llmCalls + (r.llmCallCount || 0),
          toolCalls: acc.toolCalls + (r.toolCallCount || 0),
          inputTokens: acc.inputTokens + (r.inputTokens || 0),
          outputTokens: acc.outputTokens + (r.outputTokens || 0),
          cachedInputTokens: acc.cachedInputTokens + (r.cachedInputTokens || 0),
          costCents: acc.costCents + (r.costCents || 0),
          sumSystemPromptChars: acc.sumSystemPromptChars + (r.sumSystemPromptChars || 0),
          sumHistoryChars: acc.sumHistoryChars + (r.sumHistoryChars || 0),
          sumProjectContextChars: acc.sumProjectContextChars + (r.sumProjectContextChars || 0),
          sumToolDefsChars: acc.sumToolDefsChars + (r.sumToolDefsChars || 0),
          // Priority 2 / Option C residual: tool-result accumulation tokens
          sumToolResultsAccumulatedTokens:
            acc.sumToolResultsAccumulatedTokens + (r.sumToolResultsAccumulatedTokens || 0),
        }),
        {
          llmCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0,
          cachedInputTokens: 0, costCents: 0,
          sumSystemPromptChars: 0, sumHistoryChars: 0,
          sumProjectContextChars: 0, sumToolDefsChars: 0,
          sumToolResultsAccumulatedTokens: 0,
        },
      );
      const avgInputTokensPerLlmCall = costSummary.llmCalls > 0
        ? Math.round(costSummary.inputTokens / costSummary.llmCalls)
        : 0;
      const avgToolCallsPerLlmCall = costSummary.llmCalls > 0
        ? Math.round((costSummary.toolCalls / costSummary.llmCalls) * 10) / 10
        : 0;
      const cacheHitRateOverall = costSummary.inputTokens > 0
        ? ((costSummary.cachedInputTokens / costSummary.inputTokens) * 100).toFixed(1) + '%'
        : '0.0%';
      const totalCostDollars = (costSummary.costCents / 100).toFixed(3);
      const compressionMode = process.env.ENABLE_PROMPT_COMPRESSION === 'true'
        ? 'on' : 'off';

      // Task 2: average char-based composition per LLM call (chars/4 ≈ tokens).
      // These averages tell us which compression technique to prioritize:
      //   historyAvg > 40% total → implement conversation windowing
      //   projectContextAvg > 20% total → implement context compression
      //   toolDefsAvg > 20% total → trim tool descriptions
      const tokenComposition = costSummary.llmCalls > 0 ? {
        systemPromptAvg: Math.round(costSummary.sumSystemPromptChars / costSummary.llmCalls / 4),
        historyAvg: Math.round(costSummary.sumHistoryChars / costSummary.llmCalls / 4),
        projectContextAvg: Math.round(costSummary.sumProjectContextChars / costSummary.llmCalls / 4),
        toolDefsAvg: Math.round(costSummary.sumToolDefsChars / costSummary.llmCalls / 4),
        // Priority 2 / Option C: average tool-result tokens the SDK
        // accumulates between maxSteps inside a single generateText call.
        // Computed as (real usage.inputTokens) − (sum of our char-estimates).
        // If this dominates, Task 6 should target tool-result truncation
        // rather than conversation windowing.
        toolResultsAccumulatedAvg:
          Math.round(costSummary.sumToolResultsAccumulatedTokens / costSummary.llmCalls),
      } : {
        systemPromptAvg: 0, historyAvg: 0, projectContextAvg: 0,
        toolDefsAvg: 0, toolResultsAccumulatedAvg: 0,
      };

      // Task 3: worst-case single LLM call across all agents.
      let maxSingleCallInputTokens = 0;
      let maxCallAgent: string | null = null;
      for (const r of allResults) {
        if ((r.maxSingleCallInputTokens || 0) > maxSingleCallInputTokens) {
          maxSingleCallInputTokens = r.maxSingleCallInputTokens || 0;
          maxCallAgent = r.agentType;
        }
      }

      // Priority 1: report watchdog policy + any agents it killed so
      // cost/time anomalies are easy to attribute when reviewing a scan.
      const killedAgents = allResults
        .filter(r => r.status === 'killed_idle')
        .map(r => r.agentType);

      logger.info('Scan cost breakdown', {
        sessionId: this.sessionId,
        // Task 1: clearly labeled counters
        llmCalls: costSummary.llmCalls,
        toolCalls: costSummary.toolCalls,
        inputTokens: costSummary.inputTokens,
        outputTokens: costSummary.outputTokens,
        cachedInputTokens: costSummary.cachedInputTokens,
        totalCostCents: costSummary.costCents,
        totalCostDollars,
        avgInputTokensPerLlmCall,
        avgToolCallsPerLlmCall,
        cacheHitRateOverall,
        compressionMode,
        // Priority 1: watchdog visibility
        watchdog: {
          maxAgentIdleMin: MAX_AGENT_IDLE_MIN,
          pollMs: WATCHDOG_POLL_MS,
          killedAgents,
        },
        // Task 2: token composition
        tokenComposition,
        // Task 3: worst-case LLM call
        maxSingleCallInputTokens,
        maxCallAgent,
        summary: `Scan cost breakdown: ${costSummary.llmCalls} LLM calls `
          + `(${costSummary.toolCalls} tool calls), `
          + `${(costSummary.inputTokens / 1000).toFixed(1)}K input tokens, `
          + `${(costSummary.outputTokens / 1000).toFixed(1)}K output tokens, `
          + `$${totalCostDollars} total, avg ${(avgInputTokensPerLlmCall / 1000).toFixed(1)}K input tokens/LLM call`,
        perAgent: allResults.map(r => ({
          agent: r.agentType,
          // Task 1: per-agent separation
          llmCalls: r.llmCallCount || 0,
          toolCalls: r.toolCallCount || 0,
          inputTokens: r.inputTokens || 0,
          outputTokens: r.outputTokens || 0,
          cachedInputTokens: r.cachedInputTokens || 0,
          cacheHitRate: (r.inputTokens || 0) > 0
            ? (((r.cachedInputTokens || 0) / (r.inputTokens || 1)) * 100).toFixed(1) + '%'
            : '0.0%',
          costCents: r.costCents || 0,
          model: r.modelUsed,
          maxSingleCallInputTokens: r.maxSingleCallInputTokens || 0,
        })),
      });

      // Week 2 Task 8: chromeDevtools telemetry block
      // Rolls up per-agent CDP call counts and total truncated chars so we
      // can see whether the integration is actually being used and whether
      // the output truncator is doing its job.
      const cdpTotals: Record<string, number> = {};
      let totalCdpCharsDropped = 0;
      let anyCdpCalls = false;
      for (const r of allResults) {
        if (r.cdpCallCounts) {
          for (const [tool, n] of Object.entries(r.cdpCallCounts)) {
            cdpTotals[tool] = (cdpTotals[tool] || 0) + n;
            anyCdpCalls = true;
          }
        }
        totalCdpCharsDropped += r.cdpCharsDropped || 0;
      }
      logger.info('Scan cost breakdown — chromeDevtools', {
        sessionId: this.sessionId,
        chromeDevtools: {
          enabled: this.cdpMcp !== null,
          anyCdpCallsMade: anyCdpCalls,
          toolCallsByName: cdpTotals,
          totalCharsDropped: totalCdpCharsDropped,
          lighthouseRan: !!cdpTotals['cdp_lighthouse_audit'],
          perAgent: allResults.map(r => ({
            agent: r.agentType,
            cdpCallCounts: r.cdpCallCounts || {},
            cdpCharsDropped: r.cdpCharsDropped || 0,
          })),
        },
      });

    } catch (err: any) {
      // User-initiated stop produces agent errors (MCP browser force-killed
      // mid-tool-call etc). That's expected — don't flip the DB status to
      // 'failed' or show an error toast; the route handler already set it
      // to 'cancelled' which is the truth.
      if (this.stopRequested) {
        logger.info('V2 orchestrator exiting after user-requested stop', {
          sessionId: this.sessionId,
          lastError: err?.message,
        });
      } else {
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
      }

    } finally {
      if (this.cdpMcp) {
        await this.cdpMcp.forceStop().catch(() => {});
      }
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
      // Fix 3: include QA Lead plan cost in the circuit-breaker budget
      this.cumulativeCostCents += qaLead.lastPlanUsage.costCents || 0;
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
   * Fix 3: accumulate DB-tracked cost across agents for the circuit breaker.
   */
  private accumulateCost(result: AgentResult): void {
    this.cumulativeCostCents += result.costCents || 0;
  }

  /**
   * Fix 3: hard $5 real-cost circuit breaker.
   *
   * DB-tracked cost under-reports actual Anthropic bill by ~5× (cache
   * creation tokens + tool defs are often missing from AI SDK usage).
   * We multiply tracked cost by COST_UNDERCOUNT_FACTOR before comparing
   * to the cap so we stop BEFORE blowing the real-cost budget.
   *
   * When tripped: skips remaining agents and jumps to synthesis with
   * partial data. Emits cost_cap_reached WebSocket event exactly once.
   */
  private costBudgetExceeded(): boolean {
    const estimatedRealCents = this.cumulativeCostCents * COST_UNDERCOUNT_FACTOR;
    if (estimatedRealCents >= MAX_SESSION_COST_CENTS) {
      if (!this.circuitBreakerTripped) {
        this.circuitBreakerTripped = true;
        logger.warn('Cost circuit breaker tripped — skipping remaining agents', {
          sessionId: this.sessionId,
          trackedCostCents: this.cumulativeCostCents,
          trackedCostDollars: (this.cumulativeCostCents / 100).toFixed(3),
          estimatedRealCostCents: estimatedRealCents,
          estimatedRealCostDollars: (estimatedRealCents / 100).toFixed(2),
          capDollars: (MAX_SESSION_COST_CENTS / 100).toFixed(2),
          factor: COST_UNDERCOUNT_FACTOR,
        });
        emitToSession(this.sessionId, {
          type: 'cost_cap_reached',
          data: {
            trackedCostDollars: this.cumulativeCostCents / 100,
            estimatedRealCostDollars: estimatedRealCents / 100,
            capDollars: MAX_SESSION_COST_CENTS / 100,
            message: `Cost cap reached (~$${(estimatedRealCents / 100).toFixed(2)} estimated real cost). Skipping remaining agents; synthesis will run on partial data.`,
          },
        });
      }
      return true;
    }
    return false;
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

    let agent: BaseAgent;

    switch (agentType) {
      case 'exploratory':
        agent = new ExploratoryTesterAgent(agentConfig, this.mcpBrowser!, this.cdpMcp);
        break;
      case 'security':
        agent = new SecurityTesterAgent(agentConfig, this.mcpBrowser!, this.cdpMcp);
        break;
      case 'api_tester':
        agent = new APITesterAgent(agentConfig, this.mcpBrowser!, this.cdpMcp);
        break;
      case 'auto_tester':
        // Auto Tester does NOT use the browser or CDP — only generates code
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

    // ─── Priority 1: agent idle watchdog ────────────────────────────────
    // Poll every WATCHDOG_POLL_MS. If `lastActivityAt` hasn't moved for
    // MAX_AGENT_IDLE_MIN minutes, abort the agent's AbortController — this
    // unwinds the in-flight generateText call, the agent's catch-block
    // detects the AbortError, and returns a status='killed_idle' result.
    // Orchestrator swallows the outcome and proceeds to the next agent.
    const abortController = new AbortController();
    agent.abortSignal = abortController.signal;
    const idleBudgetMs = MAX_AGENT_IDLE_MIN * 60_000;
    let watchdogTripped = false;
    const watchdog = setInterval(() => {
      const idleMs = Date.now() - agent.lastActivityAt;
      if (idleMs > idleBudgetMs && !watchdogTripped) {
        watchdogTripped = true;
        logger.warn('AGENT_WATCHDOG_TRIGGERED', {
          sessionId: this.sessionId,
          agentType,
          idleMs,
          idleBudgetMs,
          lastActivityAt: new Date(agent.lastActivityAt).toISOString(),
          policy: 'abort, mark killed_idle, continue to next agent (no retry)',
        });
        agent.killedIdle = true;
        abortController.abort();
      }
    }, WATCHDOG_POLL_MS);
    // Prevent the interval from keeping Node alive after the agent resolves.
    if (typeof (watchdog as any).unref === 'function') {
      (watchdog as any).unref();
    }

    let result: AgentResult;
    try {
      result = await agent.run();
    } finally {
      clearInterval(watchdog);
    }

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

  /**
   * Phase 5.5 — Execute every test case saved by Auto Tester through the
   * test-executor service. Updates last_run_status on each test case and
   * returns a pass/fail summary for the synthesis report.
   *
   * Uses the same ParallelTestExecutor that v1 uses, with the same
   * queue/FIFO/mismatch-detection behaviour.
   */
  private async executeGeneratedTests(): Promise<{
    testsExecuted: number;
    testsPassed: number;
    testsFailed: number;
    mismatchCount: number;
  } | null> {
    try {
      const testCases = await this.repository.getTestCases(this.sessionId, { active: true });

      if (testCases.length === 0) {
        logger.info('No test cases to execute', { sessionId: this.sessionId });
        return null;
      }

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          phase: 'test_execution',
          message: `Executing ${testCases.length} generated tests...`,
        },
      });

      logger.info('Starting test execution phase', {
        sessionId: this.sessionId,
        testCount: testCases.length,
      });

      const executor = new ParallelTestExecutor(
        this.sessionId,
        this.config,
        this.repository,
        this.cdpMcp,  // Week 2: CDP MCP for self-healing diagnostics on failures
      );

      for (const tc of testCases) {
        // observed_result lives on the test case row for v2 (saved by Auto Tester)
        const observed: 'pass' | 'fail' =
          (tc as any).observed_result === 'fail' ? 'fail' : 'pass';
        executor.enqueue(tc, observed);
      }

      await executor.waitForCompletion();
      const results = executor.getResults();
      const mismatches = executor.getMismatches();

      const summary = {
        testsExecuted: results.testsExecuted,
        testsPassed: results.testsPassed,
        testsFailed: results.testsFailed,
        mismatchCount: mismatches.length,
      };

      logger.info('Test execution phase completed', {
        sessionId: this.sessionId,
        ...summary,
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          phase: 'test_execution_complete',
          message: `Tests: ${summary.testsPassed} passed, ${summary.testsFailed} failed (of ${summary.testsExecuted})`,
          summary,
        },
      });

      return summary;
    } catch (err: any) {
      logger.error('Test execution phase failed (non-fatal)', {
        sessionId: this.sessionId,
        error: err.message,
        stack: err.stack?.slice(0, 300),
      });
      // Don't crash the scan — synthesis can still proceed without exec data
      return null;
    }
  }
}
