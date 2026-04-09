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
import { emitToSession } from '../api/websocket';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { MCPBrowser } from '../mcp-browser';
import { LoopConfig } from '../loop-orchestrator';
import { SessionPlanStore } from './session-plan';
import { AgentBoard } from './agent-board';
import { AgentType, AgentConfig, AgentResult, SessionPlan, PlanObjective } from './types';
import { QALeadAgent } from './agents/qa-lead';
import { ExploratoryTesterAgent } from './agents/exploratory-tester';

const logger = createLogger('v2-orchestrator');

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
      await this.mcpBrowser.launch();
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

      // ─── Phase 4: Security, API, Auto agents (Week 3 stubs) ───
      logger.info('Security, API, Auto agents — coming Week 3', { sessionId: this.sessionId });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { phase: 'synthesis', message: 'Agents complete. QA Lead synthesis coming Week 4.' },
      });

      // ─── Phase 5: Update session with results ─────────────────
      const totalTests = exploratoryResult.testsGenerated;
      const totalBugs = exploratoryResult.bugsFound;
      const totalPages = exploratoryResult.pagesExplored;

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
          agents: [
            {
              agent: 'exploratory',
              status: exploratoryResult.status,
              tests: exploratoryResult.testsGenerated,
              bugs: exploratoryResult.bugsFound,
              pages: exploratoryResult.pagesExplored,
            },
          ],
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
        await this.mcpBrowser.cleanup().catch(() => {});
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

    // Store in database
    const plan = await this.planStore.create(
      this.sessionId,
      planData.app_analysis,
      planData.objectives
    );

    return plan;
  }

  /**
   * Run the Exploratory Tester agent.
   */
  private async runExploratoryTester(plan: SessionPlan): Promise<AgentResult> {
    const agentConfig: AgentConfig = {
      sessionId: this.sessionId,
      agentType: 'exploratory',
      targetUrl: this.config.targetUrl,
      plan,
      projectContext: this.config.projectContext,
      loginCredentials: this.config.loginCredentials,
    };

    const agent = new ExploratoryTesterAgent(agentConfig, this.mcpBrowser!);
    return agent.run();
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
}
