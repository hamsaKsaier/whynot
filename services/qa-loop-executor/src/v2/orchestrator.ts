/**
 * V2 Orchestrator — manages the multi-agent QA team lifecycle.
 *
 * Flow:
 * 1. QA Lead creates session plan (one AI call)
 * 2. Exploratory Tester starts immediately (no dependencies)
 * 3. Security + API Testers start when Exploratory has discoveries (soft deps)
 * 4. Auto Tester starts when all others are done
 * 5. QA Lead synthesizes final report
 *
 * This runs as a parallel path alongside the v1 scan. Triggered by scan_mode='v2'.
 */
import { createLogger } from '../../../shared/logger/logger';
import { emitToSession } from '../api/websocket';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { MCPBrowser } from '../mcp-browser';
import { LoopConfig } from '../loop-orchestrator';
import { SessionPlanStore } from './session-plan';
import { AgentBoard } from './agent-board';
import { AgentType, AgentConfig, AgentResult, SessionPlan, PlanObjective } from './types';
import { QALeadAgent } from './agents/qa-lead';

const logger = createLogger('v2-orchestrator');

const DEPENDENCY_POLL_INTERVAL_MS = 10_000; // Check dependencies every 10s
const MAX_DEPENDENCY_WAIT_MS = 5 * 60 * 1000; // Max 5 min wait for deps

export class V2Orchestrator {
  private sessionId: string;
  private config: LoopConfig;
  private repository: QALoopRepository;
  private planStore: SessionPlanStore;
  private board: AgentBoard;
  private mcpBrowser: MCPBrowser | null = null;

  constructor(sessionId: string, config: LoopConfig) {
    this.sessionId = sessionId;
    this.config = config;
    this.repository = new QALoopRepository();
    this.planStore = new SessionPlanStore();
    this.board = new AgentBoard();
  }

  /**
   * Main entry point. Runs the full multi-agent session.
   */
  async run(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('V2 multi-agent session starting', {
        sessionId: this.sessionId,
        targetUrl: this.config.targetUrl,
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'planning', message: 'QA Lead analyzing app and creating test plan...' },
      });

      // ─── Phase 1: QA Lead creates session plan ─────────────────
      const plan = await this.createSessionPlan();

      if (!plan) {
        throw new Error('QA Lead failed to create session plan');
      }

      logger.info('Session plan created', {
        sessionId: this.sessionId,
        objectives: plan.objectives.length,
        appType: plan.app_analysis.app_type,
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          phase: 'execution',
          message: `Plan created: ${plan.objectives.length} objectives for ${plan.app_analysis.app_type} app`,
          plan: plan.app_analysis,
        },
      });

      // ─── Phase 2: Launch agents based on dependencies ──────────

      // Initialize the MCP browser for agents that need it
      this.mcpBrowser = new MCPBrowser(this.sessionId);
      await this.mcpBrowser.launch();

      // Login if credentials provided
      if (this.config.loginCredentials) {
        await this.performLogin();
      }

      // Run agents in dependency order
      const results = await this.executeAgents(plan);

      // ─── Phase 3: QA Lead synthesizes report ───────────────────

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'synthesis', message: 'QA Lead synthesizing final report...' },
      });

      // TODO: QA Lead synthesis (Week 4)

      // Update session with aggregate results
      const totalTests = results.reduce((s, r) => s + r.testsGenerated, 0);
      const totalBugs = results.reduce((s, r) => s + r.bugsFound, 0);
      const totalPages = results.reduce((s, r) => s + r.pagesExplored, 0);

      await this.repository.updateSessionProgress(this.sessionId, {
        testsGenerated: totalTests,
        bugsFound: totalBugs,
        pagesExplored: totalPages,
      });

      const durationMin = Math.round((Date.now() - startTime) / 60000);

      emitToSession(this.sessionId, {
        type: 'session_complete',
        data: {
          testsGenerated: totalTests,
          bugsFound: totalBugs,
          pagesExplored: totalPages,
          durationMin,
          agents: results.map(r => ({
            agent: r.agentType,
            status: r.status,
            tests: r.testsGenerated,
            bugs: r.bugsFound,
            pages: r.pagesExplored,
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
      });

      emitToSession(this.sessionId, {
        type: 'error',
        data: { message: `Multi-agent session failed: ${err.message}` },
      });

      throw err;
    } finally {
      // Cleanup browser
      if (this.mcpBrowser) {
        await this.mcpBrowser.cleanup().catch(() => {});
      }
    }
  }

  /**
   * Phase 1: QA Lead makes one AI call to analyze the app and produce a plan.
   */
  private async createSessionPlan(): Promise<SessionPlan | null> {
    const qaLead = new QALeadAgent({
      sessionId: this.sessionId,
      agentType: 'qa_lead',
      targetUrl: this.config.targetUrl,
      plan: null as any, // QA Lead creates the plan, doesn't consume one
      projectContext: this.config.projectContext,
      loginCredentials: this.config.loginCredentials,
    });

    const planData = await qaLead.createPlan();

    if (!planData) return null;

    // Store the plan in the database
    const plan = await this.planStore.create(
      this.sessionId,
      planData.app_analysis,
      planData.objectives
    );

    return plan;
  }

  /**
   * Phase 2: Execute agents respecting dependency order.
   *
   * - Exploratory starts immediately (depends_on: [])
   * - Security + API start when Exploratory has data (depends_on: [1])
   * - Auto starts when all others are done (depends_on: [1, 2, 3])
   */
  private async executeAgents(plan: SessionPlan): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const objectives = plan.objectives;

    // Group objectives by dependency depth
    const noDeps = objectives.filter(o => o.depends_on.length === 0);
    const hasDeps = objectives.filter(o => o.depends_on.length > 0);

    // Phase 2a: Run agents with no dependencies (Exploratory)
    for (const obj of noDeps) {
      const result = await this.runAgent(obj, plan);
      results.push(result);
    }

    // Phase 2b: Run remaining agents, waiting for their dependencies
    // For now, run them sequentially. In Week 3, we'll parallelize.
    for (const obj of hasDeps) {
      // Wait for dependencies (soft: just needs data in board)
      const depAgents = objectives
        .filter(o => obj.depends_on.includes(o.id))
        .map(o => o.agent);

      await this.waitForDependencies(depAgents);

      const result = await this.runAgent(obj, plan);
      results.push(result);
    }

    return results;
  }

  /**
   * Instantiate and run a single agent.
   */
  private async runAgent(objective: PlanObjective, plan: SessionPlan): Promise<AgentResult> {
    const agentConfig: AgentConfig = {
      sessionId: this.sessionId,
      agentType: objective.agent,
      targetUrl: this.config.targetUrl,
      plan,
      projectContext: this.config.projectContext,
      loginCredentials: this.config.loginCredentials,
    };

    logger.info(`Starting ${objective.agent} agent`, {
      sessionId: this.sessionId,
      objective: objective.objective,
      priority: objective.priority,
    });

    // Dynamic import to avoid circular deps — will be replaced with
    // direct imports as agents are built in Weeks 2-3
    let agent: any;

    switch (objective.agent) {
      case 'exploratory': {
        const { ExploratoryTesterAgent } = await import('./agents/exploratory-tester');
        agent = new ExploratoryTesterAgent(agentConfig, this.mcpBrowser!);
        break;
      }
      case 'security': {
        // TODO: Week 3
        logger.info('Security agent not yet implemented, skipping');
        return { agentType: 'security', status: 'done', pagesExplored: 0, testsGenerated: 0, bugsFound: 0, apiEndpointsTested: 0 };
      }
      case 'api_tester': {
        // TODO: Week 3
        logger.info('API tester agent not yet implemented, skipping');
        return { agentType: 'api_tester', status: 'done', pagesExplored: 0, testsGenerated: 0, bugsFound: 0, apiEndpointsTested: 0 };
      }
      case 'auto_tester': {
        // TODO: Week 3
        logger.info('Auto tester agent not yet implemented, skipping');
        return { agentType: 'auto_tester', status: 'done', pagesExplored: 0, testsGenerated: 0, bugsFound: 0, apiEndpointsTested: 0 };
      }
      default:
        logger.warn(`Unknown agent type: ${objective.agent}`);
        return { agentType: objective.agent, status: 'error', pagesExplored: 0, testsGenerated: 0, bugsFound: 0, apiEndpointsTested: 0, error: 'Unknown agent type' };
    }

    return agent.run();
  }

  /**
   * Wait for dependency agents to produce data.
   * Uses soft dependencies — doesn't wait for completion, just data.
   */
  private async waitForDependencies(depAgents: AgentType[]): Promise<void> {
    if (depAgents.length === 0) return;

    const startWait = Date.now();

    while (Date.now() - startWait < MAX_DEPENDENCY_WAIT_MS) {
      const met = await this.board.areDependenciesMet(this.sessionId, depAgents);
      if (met) {
        logger.info('Dependencies met', {
          sessionId: this.sessionId,
          depAgents,
          waitMs: Date.now() - startWait,
        });
        return;
      }

      await new Promise(r => setTimeout(r, DEPENDENCY_POLL_INTERVAL_MS));
    }

    // Timeout — proceed anyway
    logger.warn('Dependency wait timed out, proceeding', {
      sessionId: this.sessionId,
      depAgents,
      timeoutMs: MAX_DEPENDENCY_WAIT_MS,
    });
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

    // Wait for page to load
    await new Promise(r => setTimeout(r, 2000));

    // Fill credentials
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

    // Wait for auth to complete
    await new Promise(r => setTimeout(r, 3000));

    // Navigate to target URL
    await this.mcpBrowser.callTool('browser_navigate', { url: this.config.targetUrl });

    logger.info('Login completed for v2 session', { sessionId: this.sessionId });
  }
}
