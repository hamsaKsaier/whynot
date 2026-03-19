import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { ToolResult } from '../tool-executor';
import { emitToSession } from '../api/websocket';
import { notifyGateway } from '../notifications/email-notifier';

const logger = createLogger('report-tools');

export interface TestCaseInput {
  name: string;
  description?: string;
  steps: Array<{
    action: string;
    target?: string;
    value?: string;
    description: string;
  }>;
  category?: string;
  priority?: number;
  risk_level?: string;
  source_page_url?: string;
  observed_result?: 'pass' | 'fail';
  playwright_code?: string;
}

export interface BugInput {
  title: string;
  description?: string;
  severity: string;
  category?: string;
  bug_type?: string;
  page_url?: string;
  reproduction_steps?: string[];
  root_cause?: string;
  suggested_fix?: string;
  video_path?: string;
}

export class ReportTools {
  private sessionId: string;
  private repository: QALoopRepository;
  private onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void;

  constructor(sessionId: string, onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.onTestCaseCreated = onTestCaseCreated;
  }

  async saveTestCase(input: TestCaseInput): Promise<ToolResult> {
    try {
      // Validate steps
      if (!input.steps || input.steps.length === 0) {
        return { error: 'Test case must have at least one step' };
      }

      const testCase = await this.repository.addTestCase(this.sessionId, {
        name: input.name,
        description: input.description,
        steps: input.steps,
        category: input.category || 'functional',
        priority: input.priority || 50,
        riskLevel: input.risk_level || 'medium',
        sourcePageUrl: input.source_page_url,
        source: 'exploration',
        observedResult: input.observed_result,
        playwrightCode: input.playwright_code
      });

      // Emit event for UI update
      emitToSession(this.sessionId, {
        type: 'test_generated',
        data: {
          id: testCase.id,
          name: testCase.name,
          category: testCase.category,
          stepsCount: input.steps.length,
          observedResult: input.observed_result
        }
      });

      // Trigger parallel execution immediately (if callback registered)
      if (this.onTestCaseCreated) {
        try {
          this.onTestCaseCreated(testCase, input.observed_result);
        } catch (cbErr: any) {
          logger.warn('onTestCaseCreated callback failed', { error: cbErr.message });
        }
      }

      // Update session progress
      const allTestCases = await this.repository.getTestCases(this.sessionId);
      await this.repository.updateSessionProgress(this.sessionId, {
        testsGenerated: allTestCases.length
      });

      logger.info('Test case saved', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
        name: input.name,
        observedResult: input.observed_result
      });

      return {
        data: {
          success: true,
          testCaseId: testCase.id,
          message: `Test case "${input.name}" saved with ${input.steps.length} steps (observed: ${input.observed_result || 'not specified'})`
        },
        metrics: {
          testGenerated: true
        }
      };
    } catch (error: any) {
      logger.error('Failed to save test case', {
        sessionId: this.sessionId,
        name: input.name,
        error: error.message
      });
      return { error: `Failed to save test case: ${error.message}` };
    }
  }

  async saveBug(input: BugInput): Promise<ToolResult> {
    try {
      // Get current session for iteration number
      const session = await this.repository.getSession(this.sessionId);

      const bug = await this.repository.addBug(this.sessionId, {
        title: input.title,
        description: input.description,
        severity: input.severity,
        category: input.category,
        bugType: input.bug_type,
        pageUrl: input.page_url,
        reproductionSteps: input.reproduction_steps || [],
        rootCause: input.root_cause,
        suggestedFix: input.suggested_fix,
        iterationFound: session?.iteration_count,
        videoPath: input.video_path
      });

      // Emit event for UI update
      emitToSession(this.sessionId, {
        type: 'bug_found',
        data: {
          id: bug.id,
          title: bug.title,
          severity: bug.severity,
          category: input.category
        }
      });

      // Update session progress
      const allBugs = await this.repository.getBugs(this.sessionId);
      await this.repository.updateSessionProgress(this.sessionId, {
        bugsFound: allBugs.length
      });

      logger.info('Bug saved', {
        sessionId: this.sessionId,
        bugId: bug.id,
        title: input.title,
        severity: input.severity
      });

      // Send critical bug email notification
      if (input.severity === 'critical' || input.severity === 'high') {
        const sessionInfo = await this.repository.getSession(this.sessionId);
        if (sessionInfo?.workspace_id) {
          notifyGateway({
            type: 'critical_bug',
            workspaceId: sessionInfo.workspace_id,
            data: {
              sessionId: this.sessionId,
              targetUrl: sessionInfo.target_url,
              projectName: sessionInfo.target_url,
              bugTitle: input.title,
              severity: input.severity,
            },
          }).catch(() => {});
        }
      }

      return {
        data: {
          success: true,
          bugId: bug.id,
          message: `Bug "${input.title}" reported with severity ${input.severity}`
        },
        metrics: {
          bugFound: true
        }
      };
    } catch (error: any) {
      logger.error('Failed to save bug', {
        sessionId: this.sessionId,
        title: input.title,
        error: error.message
      });
      return { error: `Failed to save bug: ${error.message}` };
    }
  }

  async getTestCases(category?: string): Promise<ToolResult> {
    try {
      const testCases = await this.repository.getTestCases(this.sessionId, {
        category,
        active: true
      });

      return {
        data: {
          count: testCases.length,
          testCases: testCases.map(tc => ({
            id: tc.id,
            name: tc.name,
            description: tc.description,
            category: tc.category,
            priority: tc.priority,
            stepsCount: tc.steps?.length || 0,
            lastRunStatus: tc.last_run_status,
            createdAt: tc.created_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get test cases', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get test cases: ${error.message}` };
    }
  }

  async getBugs(severity?: string): Promise<ToolResult> {
    try {
      const bugs = await this.repository.getBugs(this.sessionId, {
        severity,
        status: 'open'
      });

      return {
        data: {
          count: bugs.length,
          bugs: bugs.map(b => ({
            id: b.id,
            title: b.title,
            description: b.description,
            severity: b.severity,
            category: b.category,
            pageUrl: b.page_url,
            status: b.status,
            createdAt: b.created_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get bugs', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get bugs: ${error.message}` };
    }
  }
}
