/**
 * Verifier Agent — reproduces each filed bug before it counts.
 *
 * ⚠ EXPERIMENTAL — OFF BY DEFAULT (ENABLE_BUG_VERIFIER=true to turn on).
 * This agent does not yet make reliable judgements. On a seeded test it
 * inverted both verdicts: it marked a fabricated "page failed to load" bug
 * (pointing at a route the app never had) as CONFIRMED, and marked a plausible
 * real bug as a false positive. Its own evidence explains why — it navigated to
 * the bogus URL, saw genuine "Failed to load module script" console errors, and
 * read those as the app being broken. That is the exact single-page-app trap
 * that produced the original false positives: an SPA answers 200 for any path,
 * so the app's own scripts fail against the wrong path.
 *
 * The lesson: re-observing a page with an LLM inherits the same ambiguity that
 * created the bad report. The deterministic save-time gates in report-tools.ts
 * are the reliable defence, because they use structural ground truth (was this
 * URL ever discovered via a real link?) rather than re-reading the screen.
 * Making this agent trustworthy means feeding it those structural signals —
 * discovered-page list, HTTP status — and letting them override the model when
 * they disagree. Until then it must not gate real scans.
 *
 * The specialist agents file bugs from what they observed in the moment. Some
 * of those claims are wrong in ways that are subtle but trivially falsifiable
 * once someone actually checks — a "page failed to load" for a route the app
 * never had, an XSS whose payload was in fact escaped, a tooling error blamed
 * on the app. The save-time gates in report-tools.ts catch the specific shapes
 * we have already seen; this agent is the general case.
 *
 * It runs after the specialists and before the QA Lead's synthesis. For every
 * open bug it drives the SAME browser the specialists used, follows the bug's
 * reproduction steps, and returns a verdict via the verify_bug tool:
 *   - confirmed      → the behaviour reproduces
 *   - false_positive → it does not
 *
 * The verdict is written back to qa_loop_bugs (status + verified_at), so the
 * report and the Test Results UI can separate what was proven from what was
 * merely asserted. A confirmed bug is one a human can reproduce from the steps;
 * that is the bar for anything published.
 *
 * It never files new bugs — its only mutation is a verdict on existing ones.
 */
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPBrowser } from '../../mcp-browser';
import { ChromeDevToolsMCP } from '../../chrome-devtools-mcp';
import { ToolResult } from '../../tool-executor';
import { QALoopRepository } from '../../repositories/qa-loop-repository';
import { createLogger } from '../../../../shared/logger/logger';

const logger = createLogger('verifier');

/**
 * Off by default — the agent is NOT yet trustworthy. See the header note and
 * the commit that introduced it: on a seeded test it inverted both verdicts,
 * confirming a fabricated invented-URL bug and rejecting a plausible real one.
 * Enable only to work on it: ENABLE_BUG_VERIFIER=true
 */
export function isBugVerifierEnabled(): boolean {
  return process.env.ENABLE_BUG_VERIFIER === 'true';
}

export class VerifierAgent extends BaseAgent {
  private verifierRepo = new QALoopRepository();
  private verdictCount = { confirmed: 0, false_positive: 0 };
  private verifiedBugIds = new Set<string>();
  private openBugs: Array<{ id: string; title: string; severity: string; page_url: string | null; description: string | null; steps: any[] }> = [];

  constructor(
    config: AgentConfig,
    mcpBrowser: MCPBrowser,
    cdpMcp: ChromeDevToolsMCP | null = null,
  ) {
    super(config, mcpBrowser, cdpMcp);
  }

  /**
   * Load the bugs to verify before the AI loop starts, so getInitialPrompt()
   * can list them. Only 'open' bugs — anything already confirmed by test
   * execution (see updateTestCaseLastRun) is left alone.
   */
  async run() {
    const bugs = await this.verifierRepo.getBugs(this.config.sessionId, { status: 'open' }).catch(() => []);
    this.openBugs = bugs.map(b => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
      page_url: b.page_url,
      description: b.description,
      steps: Array.isArray(b.reproduction_steps) ? b.reproduction_steps : [],
    }));
    logger.info('Verifier loaded open bugs', {
      sessionId: this.config.sessionId,
      openBugs: this.openBugs.length,
    });
    // Nothing to verify — skip the LLM call entirely rather than spend a turn
    // asking the model to verify an empty list.
    if (this.openBugs.length === 0) {
      return {
        agentType: 'verifier' as const,
        status: 'done' as const,
        pagesExplored: 0,
        testsGenerated: 0,
        bugsFound: 0,
        apiEndpointsTested: 0,
      };
    }
    return super.run();
  }

  protected getInitialPrompt(): string {
    const list = this.openBugs.map((b, i) => {
      const steps = b.steps.length
        ? b.steps.map((s: any, j: number) => `     ${j + 1}. ${s}`).join('\n')
        : '     (no steps given — decide from the description whether it reproduces)';
      return (
        `${i + 1}. bug_id: ${b.id}\n` +
        `   [${b.severity}] ${b.title}\n` +
        `   page: ${b.page_url || '(none)'}\n` +
        `   claim: ${(b.description || '').slice(0, 300)}\n` +
        `   reproduction steps:\n${steps}`
      );
    }).join('\n\n');

    return (
      `Verify each of these ${this.openBugs.length} reported bug(s). For each one: ` +
      `follow its reproduction steps in the browser, decide whether the described ` +
      `behaviour actually happens, and call verify_bug(bug_id, verdict, evidence). ` +
      `Verify EVERY bug exactly once. Be strict: if the page or feature does not ` +
      `exist, or the described effect does not occur, it is a false_positive.\n\n` +
      `BUGS TO VERIFY:\n\n${list}`
    );
  }

  /** confirmed / false_positive tallies, for the orchestrator's log + report. */
  getVerdictCounts(): { confirmed: number; false_positive: number } {
    return { ...this.verdictCount };
  }

  protected buildToolSchemas(): Record<string, { description: string; parameters: z.ZodType }> {
    const tools: Record<string, { description: string; parameters: z.ZodType }> = {};

    // The one mutation this agent can make: record a verdict on a bug.
    tools['verify_bug'] = {
      description:
        'Record whether a bug reproduces. Call this exactly once per bug after ' +
        'you have actually tried its reproduction steps in the browser. verdict ' +
        '"confirmed" = you reproduced the described behaviour; "false_positive" = ' +
        'you followed the steps and it did NOT happen (or the URL/feature does not ' +
        'exist). evidence must state concretely what you observed.',
      parameters: z.object({
        bug_id: z.string().describe('The id of the bug being verified'),
        verdict: z.enum(['confirmed', 'false_positive']).describe('Reproduction result'),
        evidence: z.string().describe('What you actually observed when following the steps'),
      }),
    };

    // Read-only browser + diagnostics — enough to reproduce, nothing that files
    // new findings. Deliberately excludes save_bug / save_test_case.
    if (this.mcpBrowser) {
      const include = [
        'browser_navigate', 'browser_snapshot', 'browser_click',
        'browser_fill', 'browser_type', 'browser_evaluate', 'browser_press_key',
      ];
      for (const tool of this.mcpBrowser.getTools()) {
        if (!include.includes(tool.name)) continue;
        tools[tool.name] = {
          description: tool.description || `Browser tool: ${tool.name}`,
          parameters: this.convertSchema(tool.input_schema),
        };
      }
    }
    if (this.cdpMcp) {
      for (const tool of this.cdpMcp.getTools()) {
        tools[tool.name] = {
          description: tool.description || `Chrome DevTools tool: ${tool.name}`,
          parameters: this.convertSchema(tool.input_schema),
        };
      }
    }

    return tools;
  }

  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    if (toolName === 'verify_bug') {
      const bugId = String(args.bug_id || '').trim();
      const verdict = args.verdict === 'confirmed' ? 'confirmed' : 'false_positive';
      const evidence = String(args.evidence || '').trim();

      if (!bugId) {
        return { error: 'verify_bug requires bug_id.' };
      }
      // Each bug is verified once. Without this the model re-visits bugs it has
      // already judged, burning calls (observed: 5× per bug) and risking a
      // verdict flip. A verdict already recorded means the bug left 'open'.
      if (this.verifiedBugIds.has(bugId)) {
        return {
          data: {
            success: true,
            alreadyVerified: true,
            message: `Bug ${bugId} is already verified. Move to a bug you have not verified yet, or stop if all are done.`,
          },
        };
      }
      try {
        await this.verifierRepo.setBugVerdict(this.config.sessionId, bugId, verdict, evidence);
        this.verifiedBugIds.add(bugId);
        this.verdictCount[verdict]++;
        logger.info('Bug verdict recorded', {
          sessionId: this.config.sessionId, bugId, verdict,
        });
        return {
          data: {
            success: true,
            message: `Recorded ${verdict} for bug ${bugId}. Move to the next bug.`,
          },
        };
      } catch (err: any) {
        logger.error('Failed to record verdict', { bugId, error: err.message });
        return { error: `Could not record verdict: ${err.message}` };
      }
    }

    return super.executeTool(toolName, args);
  }

  protected getMaxLoops(): number {
    // Verification is bounded by the number of open bugs, not by exploration
    // breadth. A handful of outer loops covers a normal scan's bug count.
    return 4;
  }

  /** JSON-Schema → zod, matching the other browser agents' conversion. */
  private convertSchema(schema: any): z.ZodType {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodType> = {};
    const required = new Set(schema.required || []);

    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as any;
      let zodType: z.ZodType;

      switch (p.type) {
        case 'string':
          zodType = z.string().describe(p.description || key);
          break;
        case 'number':
        case 'integer':
          zodType = z.number().describe(p.description || key);
          break;
        case 'boolean':
          zodType = z.boolean().describe(p.description || key);
          break;
        case 'array':
          zodType = z.array(z.any()).describe(p.description || key);
          break;
        case 'object':
          zodType = z.record(z.string(), z.any()).describe(p.description || key);
          break;
        default:
          zodType = z.any().describe(p.description || key);
      }

      shape[key] = required.has(key) ? zodType : zodType.optional();
    }

    return z.object(shape);
  }
}
