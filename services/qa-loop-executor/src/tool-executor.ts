import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { BrowserTools } from './tools/browser-tools';
import { StateTools } from './tools/state-tools';
import { ReportTools } from './tools/report-tools';
import { ChaosTools } from './tools/chaos-tools';
import { DetectiveTools } from './tools/detective-tools';
import { GuardianTools } from './tools/guardian-tools';

const logger = createLogger('tool-executor');

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
  private browserTools: BrowserTools;
  private stateTools: StateTools;
  private reportTools: ReportTools;
  private chaosTools: ChaosTools;
  private detectiveTools: DetectiveTools;
  private guardianTools: GuardianTools;

  constructor(sessionId: string, config: LoopConfig) {
    this.sessionId = sessionId;
    this.config = config;
    this.browserTools = new BrowserTools(sessionId, config);
    this.stateTools = new StateTools(sessionId);
    this.reportTools = new ReportTools(sessionId);
    this.chaosTools = new ChaosTools(sessionId);
    this.detectiveTools = new DetectiveTools(sessionId);
    this.guardianTools = new GuardianTools(sessionId);
  }

  async execute(toolName: string, input: Record<string, any>): Promise<ToolResult> {
    logger.debug('Executing tool', { sessionId: this.sessionId, tool: toolName, input });

    try {
      switch (toolName) {
        // Browser Tools
        case 'navigate':
          return await this.browserTools.navigate(input.url);

        case 'click':
          return await this.browserTools.click(input.selector);

        case 'type_text':
          return await this.browserTools.typeText(input.selector, input.text, input.clear_first);

        case 'screenshot':
          return await this.browserTools.screenshot();

        case 'get_page_elements':
          return await this.browserTools.getPageElements();

        case 'scroll':
          return await this.browserTools.scroll(input.direction, input.amount);

        case 'go_back':
          return await this.browserTools.goBack();

        case 'wait':
          return await this.browserTools.wait(input.milliseconds);

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
          // Thread real load time (captured during navigate()) into discovered_elements
          const cachedLoadTime = this.browserTools.getLoadTime(input.url);
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
    await this.browserTools.cleanup();
  }
}
