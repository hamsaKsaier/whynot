import { SetupHook, TestStep } from '../../shared/types';
import { SetupHookRepository, SetupHookEntity } from '../../shared/database/repositories/setup-hook-repository';
import { StepExecutor } from './step-executor';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('setup-executor');

/**
 * Setup Executor
 * Loads and executes setup hooks before test execution
 */
export class SetupExecutor {
  private setupHookRepository: SetupHookRepository;
  private stepExecutor: StepExecutor;

  constructor(stepExecutor: StepExecutor) {
    this.setupHookRepository = new SetupHookRepository();
    this.stepExecutor = stepExecutor;
  }

  /**
   * Load setup hooks for a test case
   * Returns hooks in execution order: global → suite → test_case
   * folderId is optional - if not provided, will attempt to find it from test case's user_story
   */
  async loadHooks(testCaseId: string, folderId?: string | null): Promise<SetupHookEntity[]> {
    try {
      let actualFolderId = folderId;
      
      // If folderId not provided, try to get it from the test case's user_story
      if (!actualFolderId) {
        const { query } = await import('../../shared/database/connection');
        const result = await query<{ folder_id: string | null }>(
          `SELECT us.folder_id 
           FROM test_cases tc
           JOIN user_stories us ON tc.user_story_id = us.id
           WHERE tc.id = $1`,
          [testCaseId]
        );
        actualFolderId = result[0]?.folder_id || null;
      }

      const { global, suite, testCase } = await this.setupHookRepository.findAllForTestCase(
        testCaseId,
        actualFolderId
      );

      // Return in execution order
      return [...global, ...suite, ...testCase];
    } catch (error: any) {
      logger.error('Failed to load setup hooks', { error: error.message, testCaseId });
      return [];
    }
  }

  /**
   * Execute setup hooks
   * Returns success status and any error message
   */
  async executeHooks(
    hooks: SetupHookEntity[],
    sendLog?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (hooks.length === 0) {
      return { success: true };
    }

    const log = sendLog || ((level: string, msg: string) => console.log(msg));

    log('info', `\n🔧 Executing ${hooks.length} setup hook(s)...`);

    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      const steps = hook.steps as TestStep[];

      log('info', `\n📋 Setup Hook ${i + 1}/${hooks.length}: ${hook.name} (${hook.level})`);

      try {
        // Execute each step in the hook
        for (let j = 0; j < steps.length; j++) {
          const step = steps[j];
          log('info', `   Step ${j + 1}/${steps.length}: ${step.description || step.action}`);

          const stepResult = await this.stepExecutor.executeStep(step, j, log);

          if (!stepResult.success) {
            const errorMsg = `Setup hook "${hook.name}" failed at step ${j + 1}: ${stepResult.error}`;
            log('error', `   ❌ ${errorMsg}`);
            return { success: false, error: errorMsg };
          }

          log('info', `   ✅ Step ${j + 1} passed (${stepResult.execution_time_ms}ms)`);
        }

        log('info', `✅ Setup hook "${hook.name}" completed successfully`);
      } catch (error: any) {
        const errorMsg = `Setup hook "${hook.name}" failed: ${error.message}`;
        log('error', `❌ ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }

    log('info', '✅ All setup hooks completed successfully\n');
    return { success: true };
  }
}

