/**
 * QA Lead Agent — the planner and reviewer.
 *
 * Phase 1 (Planning): Makes ONE AI call to analyze the target app and
 * produce a session plan with objectives for each agent.
 *
 * Phase 2 (Synthesis): After all agents finish, reads all findings,
 * cross-references them, and produces a unified report with quality score.
 */
import { generateText } from 'ai';
import { createLogger } from '../../../../shared/logger/logger';
import { AgentConfig, AgentResult, AppAnalysis, PlanObjective, AgentBoardEntry } from '../types';
import { AgentContextBuilder } from '../agent-context-builder';
import { AgentBoard } from '../agent-board';
import { selectModel } from './base-agent';

const logger = createLogger('qa-lead');

export interface SynthesisReport {
  summary: string;
  quality_score: number;
  findings_by_agent: Record<string, any>;
  critical_clusters: Array<{
    page: string;
    issues: string[];
    priority: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  recommendations: string[];
}

export class QALeadAgent {
  private config: AgentConfig;
  private contextBuilder: AgentContextBuilder;

  constructor(config: AgentConfig) {
    this.config = config;
    this.contextBuilder = new AgentContextBuilder();
  }

  // ─── Phase 1: Planning ──────────────────────────────────────────────

  async createPlan(): Promise<{
    app_analysis: AppAnalysis;
    objectives: PlanObjective[];
  } | null> {
    const { model, name: modelName } = selectModel('qa_lead');

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      'qa_lead',
      this.config.targetUrl,
      null as any,
      this.config.projectContext,
      [],
    );

    logger.info('QA Lead creating session plan', {
      sessionId: this.config.sessionId,
      model: modelName,
    });

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze ${this.config.targetUrl} and create a test plan. Respond with ONLY a JSON object containing app_analysis and objectives. No extra text.`,
        }],
        maxOutputTokens: 1024,
      });

      const text = result.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('QA Lead response not valid JSON', { response: text.slice(0, 200) });
        return this.getDefaultPlan();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.app_analysis || !parsed.objectives || !Array.isArray(parsed.objectives)) {
        return this.getDefaultPlan();
      }

      const appAnalysis: AppAnalysis = {
        app_type: parsed.app_analysis.app_type || 'web_app',
        critical_flows: parsed.app_analysis.critical_flows || ['login', 'main_page'],
        risk_areas: parsed.app_analysis.risk_areas || ['forms', 'auth'],
        total_pages_to_test: parsed.app_analysis.total_pages_to_test || 10,
      };

      const objectives: PlanObjective[] = parsed.objectives.map((o: any, idx: number) => ({
        id: o.id || idx + 1,
        agent: o.agent || 'exploratory',
        objective: o.objective || 'Explore and test',
        pages: o.pages || [],
        priority: o.priority || 'medium',
        depends_on: o.depends_on || [],
      }));

      logger.info('QA Lead plan created', { appType: appAnalysis.app_type, objectives: objectives.length });
      return { app_analysis: appAnalysis, objectives };

    } catch (err: any) {
      logger.error('QA Lead plan failed', { error: err.message });
      return this.getDefaultPlan();
    }
  }

  // ─── Phase 2: Synthesis ─────────────────────────────────────────────

  /**
   * After all agents finish, synthesize findings into a unified report.
   * Makes one AI call with all agent outputs as context.
   */
  async synthesize(
    agentResults: AgentResult[],
    boardEntries: AgentBoardEntry[],
    bugs: any[],
    testCases: any[],
    pages: any[]
  ): Promise<SynthesisReport> {
    const { model, name: modelName } = selectModel('qa_lead');

    // Build compact context from all agent data
    const agentSummaries = agentResults.map(r =>
      `${r.agentType}: ${r.status}, pages=${r.pagesExplored}, tests=${r.testsGenerated}, bugs=${r.bugsFound}, api=${r.apiEndpointsTested}`
    ).join('\n');

    const boardSummary = boardEntries.map(e => {
      const discoveryCount = Array.isArray(e.discoveries) ? e.discoveries.length : 0;
      return `${e.agent_type}: ${e.status}, ${discoveryCount} discoveries, ${e.bugs_found} bugs`;
    }).join('\n');

    // Group bugs by page for cluster detection
    const bugsByPage: Record<string, Array<{ title: string; agent: string; severity: string }>> = {};
    for (const bug of bugs) {
      const page = bug.page_url || 'unknown';
      if (!bugsByPage[page]) bugsByPage[page] = [];
      bugsByPage[page].push({
        title: bug.title,
        agent: bug.agent_source || 'unknown',
        severity: bug.severity,
      });
    }

    const clusterSummary = Object.entries(bugsByPage)
      .filter(([, b]) => b.length >= 2)
      .map(([page, b]) => `${page}: ${b.map(x => `[${x.agent}] ${x.title}`).join(', ')}`)
      .slice(0, 5)
      .join('\n');

    const bugList = bugs.slice(0, 15).map(b =>
      `[${b.severity}] ${b.title} (${b.agent_source || 'unknown'})${b.page_url ? ` on ${b.page_url}` : ''}`
    ).join('\n');

    const systemPrompt = `You are the QA Lead writing a synthesis report for ${this.config.targetUrl}.
Analyze the findings and produce a JSON report. Be concise and actionable.

Respond with ONLY a JSON object:
{
  "summary": "one-line summary",
  "quality_score": 0-100,
  "findings_by_agent": { "exploratory": {...}, "security": {...}, "api": {...}, "auto": {...} },
  "critical_clusters": [{ "page": "url", "issues": ["..."], "priority": "critical|high|medium", "recommendation": "..." }],
  "recommendations": ["..."]
}

Quality score guidance: 90+ = excellent, 70-89 = good, 50-69 = needs work, <50 = poor.
A cluster is when multiple agents found issues on the SAME page.`;

    const userMsg = `AGENT RESULTS:\n${agentSummaries}

BOARD:\n${boardSummary}

BUGS FOUND (${bugs.length}):\n${bugList}

PAGES WHERE MULTIPLE AGENTS FOUND ISSUES:\n${clusterSummary || 'None'}

TESTS GENERATED: ${testCases.length}
PAGES EXPLORED: ${pages.length}

Produce the synthesis report JSON.`;

    logger.info('QA Lead synthesizing report', { sessionId: this.config.sessionId, model: modelName });

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
        maxOutputTokens: 1500,
      });

      const text = result.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[0]) as SynthesisReport;
        // Ensure required fields
        report.summary = report.summary || `Scanned ${pages.length} pages, found ${bugs.length} bugs, generated ${testCases.length} tests`;
        report.quality_score = typeof report.quality_score === 'number' ? report.quality_score : 65;
        report.findings_by_agent = report.findings_by_agent || {};
        report.critical_clusters = report.critical_clusters || [];
        report.recommendations = report.recommendations || [];
        return report;
      }
    } catch (err: any) {
      logger.error('QA Lead synthesis AI call failed', { error: err.message });
    }

    // Fallback: build report from raw data
    return this.buildFallbackReport(agentResults, bugs, testCases, pages, bugsByPage);
  }

  // ─── Fallbacks ──────────────────────────────────────────────────────

  private buildFallbackReport(
    agentResults: AgentResult[],
    bugs: any[],
    testCases: any[],
    pages: any[],
    bugsByPage: Record<string, any[]>
  ): SynthesisReport {
    const totalBugs = bugs.length;
    const criticalBugs = bugs.filter(b => b.severity === 'critical' || b.severity === 'high').length;

    const clusters = Object.entries(bugsByPage)
      .filter(([, b]) => b.length >= 2)
      .map(([page, b]) => ({
        page,
        issues: b.map((x: any) => `${x.title} (${x.agent})`),
        priority: b.some((x: any) => x.severity === 'critical') ? 'critical' as const : 'high' as const,
        recommendation: `Fix ${b.length} issues on ${page}`,
      }));

    const score = Math.max(20, Math.min(95, 80 - (criticalBugs * 10) - (totalBugs * 2) + (testCases.length * 2)));

    return {
      summary: `Scanned ${pages.length} pages, found ${totalBugs} bugs (${criticalBugs} critical/high), generated ${testCases.length} tests`,
      quality_score: score,
      findings_by_agent: Object.fromEntries(
        agentResults.map(r => [r.agentType, {
          pages: r.pagesExplored, tests: r.testsGenerated,
          bugs: r.bugsFound, endpoints: r.apiEndpointsTested,
        }])
      ),
      critical_clusters: clusters,
      recommendations: [
        ...(criticalBugs > 0 ? ['Fix critical/high severity bugs immediately'] : []),
        ...(bugs.some(b => b.bug_type === 'xss' || b.category === 'security') ? ['Add Content Security Policy headers'] : []),
        'Increase test coverage for uncovered pages',
      ],
    };
  }

  private getDefaultPlan() {
    return {
      app_analysis: {
        app_type: 'web_app',
        critical_flows: ['login', 'navigation', 'main_features'],
        risk_areas: ['forms', 'authentication', 'data_display'],
        total_pages_to_test: 10,
      },
      objectives: [
        { id: 1, agent: 'exploratory' as const, objective: `Explore all pages of ${this.config.targetUrl}`, pages: [], priority: 'critical' as const, depends_on: [] },
        { id: 2, agent: 'security' as const, objective: 'Test forms for XSS, SQLi, CSRF', priority: 'high' as const, depends_on: [1] },
        { id: 3, agent: 'api_tester' as const, objective: 'Test API endpoints with edge cases', priority: 'high' as const, depends_on: [1] },
        { id: 4, agent: 'auto_tester' as const, objective: 'Write Playwright regression tests', priority: 'medium' as const, depends_on: [1, 2, 3] },
      ],
    };
  }
}
