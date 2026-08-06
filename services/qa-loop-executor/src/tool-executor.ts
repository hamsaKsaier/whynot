import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { MCPBrowser } from './mcp-browser';
import { ChromeDevToolsMCP, truncateCdpToolResult } from './chrome-devtools-mcp';
import { StateTools } from './tools/state-tools';
import { ReportTools } from './tools/report-tools';
import { ChaosTools } from './tools/chaos-tools';
import { DetectiveTools } from './tools/detective-tools';
import { GuardianTools } from './tools/guardian-tools';
import { isWithinScanScope, outOfScopeMessage, logOutOfScope } from './scan-scope';

const logger = createLogger('tool-executor');

/**
 * Tools that take a URL the agent chose, and so can carry a scan off the
 * target app. Enforced here rather than in each tool because this is the one
 * point every agent's tool call passes through.
 */
const URL_SCOPED_TOOLS = new Set(['browser_navigate', 'add_discovered_page']);

export interface ToolResult {
  data?: any;
  error?: string;
  metrics?: {
    pageExplored?: boolean;
    testGenerated?: boolean;
    bugFound?: boolean;
    vulnerabilityFound?: boolean;
  };
}

export class ToolExecutor {
  private sessionId: string;
  private config: LoopConfig;
  private mcpBrowser: MCPBrowser;
  private cdpMcp: ChromeDevToolsMCP | null;
  private stateTools: StateTools;
  private reportTools: ReportTools;
  private chaosTools: ChaosTools;
  private detectiveTools: DetectiveTools;
  private guardianTools: GuardianTools;
  // Week 2 Task 8 telemetry: per-tool call counts + truncated chars
  public cdpCallCounts = new Map<string, number>();
  public cdpCharsDropped = 0;

  constructor(
    sessionId: string,
    config: LoopConfig,
    mcpBrowser: MCPBrowser,
    onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void,
    cdpMcp: ChromeDevToolsMCP | null = null,
    // v4 Phase 1: optional bus + agent identity. Plumbed into ReportTools
    // so saveBug / saveTestCase publish bug.confirmed / test.saved events
    // after their DB writes succeed. Null when ENABLE_V4_EVENT_BUS is off.
    eventBus: any | null = null,
    eventBusAgentType: any | null = null,
  ) {
    this.sessionId = sessionId;
    this.config = config;
    this.mcpBrowser = mcpBrowser;
    this.cdpMcp = cdpMcp;
    this.stateTools = new StateTools(sessionId);
    this.reportTools = new ReportTools(sessionId, onTestCaseCreated, config.loginCredentials);
    this.reportTools.setEventBusContext(eventBus, eventBusAgentType);
    this.chaosTools = new ChaosTools(sessionId);
    this.detectiveTools = new DetectiveTools(sessionId);
    this.guardianTools = new GuardianTools(sessionId);
  }

  async execute(toolName: string, input: Record<string, any>): Promise<ToolResult> {
    logger.debug('Executing tool', { sessionId: this.sessionId, tool: toolName, input });

    // Keep the scan on the app it was pointed at. Apps link outward, and an
    // agent that follows those links ends up crawling — and, in the Security
    // agent's case, submitting attack payloads to — a site the operator does
    // not own. Refused here for every agent, before the tool runs.
    if (URL_SCOPED_TOOLS.has(toolName) && typeof input?.url === 'string') {
      const inScope = isWithinScanScope(input.url, this.config.targetUrl, [
        this.config.loginCredentials?.loginUrl,
      ]);
      if (!inScope) {
        logOutOfScope(this.sessionId, toolName, input.url, this.config.targetUrl);
        return { error: outOfScopeMessage(input.url, this.config.targetUrl) };
      }
    }

    try {
      // Route MCP browser tools (browser_navigate, browser_click, browser_snapshot, etc.)
      if (this.mcpBrowser.isMCPTool(toolName)) {
        return await this.mcpBrowser.callTool(toolName, input);
      }

      // Route Chrome DevTools MCP tools (cdp_list_console_messages, etc.).
      // Output truncation applied BEFORE the result enters the agent's history.
      if (this.cdpMcp && this.cdpMcp.isCdpTool(toolName)) {
        const result = await this.cdpMcp.callTool(toolName, input);
        this.cdpCallCounts.set(toolName, (this.cdpCallCounts.get(toolName) || 0) + 1);
        if (result.data !== undefined) {
          const { truncated, charsDropped } = truncateCdpToolResult(toolName, result.data, input);
          this.cdpCharsDropped += charsDropped;
          return { data: truncated };
        }
        return result;
      }

      switch (toolName) {
        // State Tools
        case 'get_session_state':
          return await this.stateTools.getSessionState();

        case 'get_explored_pages':
          return await this.stateTools.getExploredPages();

        case 'get_unexplored_pages':
          return await this.stateTools.getUnexploredPages();

        case 'get_notes':
          return await this.stateTools.getNotes(input.category);

        case 'add_note':
          return await this.stateTools.addNote(input.note, input.category, input.page_url);

        case 'add_discovered_page':
          return await this.stateTools.addDiscoveredPage(input.url, input.priority);

        case 'mark_page_explored': {
          // Thread real load time (captured during browser_navigate) into discovered_elements
          const cachedLoadTime = this.mcpBrowser.getLoadTime(input.url);
          return await this.stateTools.markPageExplored(input.url, input.description, input.page_type, cachedLoadTime);
        }

        // Report Tools
        case 'save_test_case':
          return await this.reportTools.saveTestCase(input as any);

        case 'save_bug':
          return await this.reportTools.saveBug(input as any);

        case 'get_test_cases':
          return await this.reportTools.getTestCases(input.category);

        case 'get_bugs':
          return await this.reportTools.getBugs(input.severity);

        // Chaos Tools (Phase 3)
        case 'plan_chaos_attacks':
          return { data: await this.chaosTools.planChaosAttacks(input as any) };

        case 'run_injection_test':
          return {
            data: await this.chaosTools.runInjectionTest(input as any),
            metrics: { vulnerabilityFound: true }
          };

        case 'run_boundary_test':
          return { data: await this.chaosTools.runBoundaryTest(input as any) };

        case 'run_timing_test':
          return { data: await this.chaosTools.runTimingTest(input as any) };

        case 'run_security_scan':
          return { data: await this.chaosTools.runSecurityScan(input as any) };

        case 'run_accessibility_audit':
          return { data: await this.chaosTools.runAccessibilityAudit(input as any) };

        case 'save_vulnerability':
          return {
            data: await this.chaosTools.saveVulnerability(input as any),
            metrics: { bugFound: true, vulnerabilityFound: true }
          };

        // Detective Tools (Phase 4)
        case 'analyze_failure':
          return { data: await this.detectiveTools.analyzeFailure(input as any) };

        case 'get_test_history':
          return { data: await this.detectiveTools.getTestHistory(input as any) };

        case 'correlate_failures':
          return { data: await this.detectiveTools.correlateFailures(input as any) };

        case 'minimize_reproduction':
          return { data: await this.detectiveTools.minimizeReproduction(input as any) };

        case 'classify_flaky':
          return { data: await this.detectiveTools.classifyFlaky(input as any) };

        case 'save_root_cause':
          return { data: await this.detectiveTools.saveRootCause(input as any) };

        // Guardian Tools (Phase 5)
        case 'calculate_quality_score':
          return { data: await this.guardianTools.calculateQualityScore() };

        case 'plan_next_iteration':
          return { data: await this.guardianTools.planNextIteration(input as any) };

        case 'should_continue':
          return { data: await this.guardianTools.shouldContinue(input as any) };

        case 'generate_report':
          return { data: await this.guardianTools.generateReport(input as any) };

        case 'get_budget_status':
          return { data: await this.guardianTools.getBudgetStatus() };

        case 'set_budget_limits':
          return { data: await this.guardianTools.setBudgetLimits(input as any) };

        case 'get_recommendations':
          return { data: await this.guardianTools.getRecommendations() };

        case 'get_quality_trend':
          return { data: await this.guardianTools.getQualityTrend(input as any) };

        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      logger.error('Tool execution failed', {
        sessionId: this.sessionId,
        tool: toolName,
        error: error.message
      });
      return { error: error.message };
    }
  }

  async cleanup(): Promise<void> {
    // MCP browser lifecycle is managed by LoopOrchestrator — nothing to clean up here
  }
}
