import { TestStep, ElementSelector, FailureCategory, FailureAnalysis, TestCase } from '../domain/models';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { HybridSelector } from '../infrastructure/selectors/hybrid-selector';
import { AgentRecovery } from './agent_recovery';
import { PatternRecovery } from './pattern-recovery';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('recovery-strategies');

export interface RecoveryResult {
  success: boolean;
  selector?: ElementSelector;
  error?: string;
  strategyUsed?: string;
}

export interface RecoveryStrategy {
  canHandle(category: FailureCategory): boolean;
  attemptRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    testCase?: TestCase
  ): Promise<RecoveryResult>;
}

/**
 * Recovery strategy for selector failures
 */
export class SelectorRecovery implements RecoveryStrategy {
  private agentRecovery: AgentRecovery;
  private aiServiceUrl: string;

  constructor(aiServiceUrl: string = 'http://localhost:8000') {
    this.aiServiceUrl = aiServiceUrl;
    this.agentRecovery = new AgentRecovery(aiServiceUrl);
  }

  canHandle(category: FailureCategory): boolean {
    return category === FailureCategory.SELECTOR_FAILURE || 
           category === FailureCategory.SELECTOR_INSTABILITY;
  }

  async attemptRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    testCase?: TestCase
  ): Promise<RecoveryResult> {
    logger.info('Attempting selector recovery', { stepId: step.id });

    try {
      // Get current page state
      const html = await browserController.getPageHTML();
      const screenshotPath = await browserController.takeScreenshot();
      
      // Read screenshot as base64
      const fs = require('fs');
      let screenshotBase64: string | undefined;
      try {
        if (screenshotPath && fs.existsSync(screenshotPath)) {
          const screenshotBuffer = fs.readFileSync(screenshotPath);
          screenshotBase64 = screenshotBuffer.toString('base64');
        }
      } catch (e) {
        logger.warn('Failed to read screenshot for recovery', { error: e });
        // Continue without screenshot
      }

      // Request AI recovery
      const recoveryRequest = {
        step_id: step.id,
        step_description: step.description || '',
        target_description: step.target!,
        attempted_selectors: step.suggested_selectors || [],
        error_message: analysis.reason,
        html: html,
        screenshot_base64: screenshotBase64
      };

      const recoveryResponse = await this.agentRecovery.requestRecovery(recoveryRequest);

      if (recoveryResponse.success && recoveryResponse.new_selectors && recoveryResponse.new_selectors.length > 0) {
        // Try the new selectors
        for (const selector of recoveryResponse.new_selectors) {
          try {
            const locator = this.getPlaywrightLocator(page, selector);
            if (locator) {
              const count = await locator.count();
              if (count > 0) {
                const isVisible = await locator.first().isVisible().catch(() => false);
                if (isVisible) {
                  logger.info('Selector recovery successful', { selector: selector.value });
                  return {
                    success: true,
                    selector,
                    strategyUsed: 'ai_recovery'
                  };
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
      }

      // If AI recovery failed, try hybrid selector as fallback
      if (step.target) {
        const selectors = await hybridSelector.findElement(html, screenshotPath, step.target);
        if (selectors.length > 0) {
          const result = await hybridSelector.locateElementWithSelectors(page, selectors);
          if (result.found && result.selector) {
            logger.info('Hybrid selector recovery successful', { selector: result.selector.value });
            return {
              success: true,
              selector: result.selector,
              strategyUsed: 'hybrid_selector'
            };
          }
        }
      }

      return {
        success: false,
        error: 'All recovery strategies failed',
        strategyUsed: 'selector_recovery'
      };
    } catch (error: any) {
      logger.error('Selector recovery failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        strategyUsed: 'selector_recovery'
      };
    }
  }

  private getPlaywrightLocator(page: any, selector: ElementSelector): any {
    switch (selector.type) {
      case 'data-testid':
      case 'id':
      case 'class':
      case 'aria-label':
      case 'css':
        return page.locator(selector.value);

      case 'text':
        const textMatch = selector.value.match(/text="(.+)"/);
        if (textMatch) {
          return page.getByText(textMatch[1], { exact: false });
        }
        return null;

      case 'xpath':
        return page.locator(selector.value);

      default:
        return null;
    }
  }
}

/**
 * Recovery strategy for timing failures
 */
export class TimingRecovery implements RecoveryStrategy {
  canHandle(category: FailureCategory): boolean {
    return category === FailureCategory.TIMING_FAILURE;
  }

  async attemptRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    testCase?: TestCase
  ): Promise<RecoveryResult> {
    logger.info('Attempting timing recovery', { stepId: step.id });

    try {
      // Wait longer and retry
      await browserController.waitForTimeout(2000);

      // If it's an element interaction step, try to find element again
      if (step.target && (step.action === 'click' || step.action === 'type' || step.action === 'fill' || step.action === 'hover')) {
        const html = await browserController.getPageHTML();
        const screenshotPath = await browserController.takeScreenshot();
        const selectors = await hybridSelector.findElement(html, screenshotPath, step.target);

        if (selectors.length > 0) {
          const result = await hybridSelector.locateElementWithSelectors(page, selectors);
          if (result.found && result.selector) {
            logger.info('Timing recovery successful after wait', { selector: result.selector.value });
            return {
              success: true,
              selector: result.selector,
              strategyUsed: 'wait_and_retry'
            };
          }
        }
      }

      return {
        success: false,
        error: 'Element still not ready after additional wait',
        strategyUsed: 'timing_recovery'
      };
    } catch (error: any) {
      logger.error('Timing recovery failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        strategyUsed: 'timing_recovery'
      };
    }
  }
}

/**
 * Recovery strategy for page load failures
 */
export class PageStateRecovery implements RecoveryStrategy {
  canHandle(category: FailureCategory): boolean {
    return category === FailureCategory.PAGE_LOAD_FAILURE;
  }

  async attemptRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    testCase?: TestCase
  ): Promise<RecoveryResult> {
    logger.info('Attempting page state recovery', { stepId: step.id });

    try {
      // Wait for page to be ready
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await browserController.waitForTimeout(1000);

      // Check if page is now loaded
      const url = page.url();
      const title = await page.title().catch(() => '');

      if (url && title) {
        logger.info('Page state recovery successful', { url, title });
        return {
          success: true,
          strategyUsed: 'page_load_recovery'
        };
      }

      return {
        success: false,
        error: 'Page still not loaded after recovery attempt',
        strategyUsed: 'page_state_recovery'
      };
    } catch (error: any) {
      logger.error('Page state recovery failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        strategyUsed: 'page_state_recovery'
      };
    }
  }
}

/**
 * Recovery strategy manager
 */
export class RecoveryManager {
  private strategies: RecoveryStrategy[];
  private patternRecovery: PatternRecovery;
  private aiServiceUrl: string;

  constructor(aiServiceUrl: string = 'http://localhost:8000') {
    this.aiServiceUrl = aiServiceUrl;
    this.patternRecovery = new PatternRecovery();
    this.strategies = [
      new SelectorRecovery(aiServiceUrl),
      new TimingRecovery(),
      new PageStateRecovery()
    ];
  }

  async attemptRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    testCase?: TestCase
  ): Promise<RecoveryResult> {
    // For selector failures, try pattern recovery and AI recovery in parallel
    if (analysis.category === FailureCategory.SELECTOR_FAILURE || 
        analysis.category === FailureCategory.SELECTOR_INSTABILITY) {
      
      // Check if pattern recovery can handle this
      const canUsePattern = this.patternRecovery.canHandle(analysis.category);
      
      if (canUsePattern && testCase) {
        // Try both pattern recovery and AI recovery in parallel
        logger.info('Attempting parallel recovery: pattern + AI', { stepId: step.id });
        
        const [patternResult, aiResult] = await Promise.allSettled([
          this.patternRecovery.attemptRecovery(step, analysis, page, browserController, hybridSelector, testCase),
          this.attemptAIRecovery(step, analysis, page, browserController, hybridSelector)
        ]);

        // Use first successful result
        if (patternResult.status === 'fulfilled' && patternResult.value.success) {
          logger.info('Pattern recovery succeeded', { strategy: patternResult.value.strategyUsed });
          return patternResult.value;
        }
        
        if (aiResult.status === 'fulfilled' && aiResult.value.success) {
          logger.info('AI recovery succeeded', { strategy: aiResult.value.strategyUsed });
          return aiResult.value;
        }

        // Both failed, return the pattern result (or AI result if pattern didn't run)
        if (patternResult.status === 'fulfilled') {
          return patternResult.value;
        }
        if (aiResult.status === 'fulfilled') {
          return aiResult.value;
        }
      } else {
        // Fall back to AI recovery only
        return await this.attemptAIRecovery(step, analysis, page, browserController, hybridSelector);
      }
    }

    // For other failure types, use existing strategies
    const strategy = this.strategies.find(s => s.canHandle(analysis.category));

    if (!strategy) {
      return {
        success: false,
        error: `No recovery strategy available for category: ${analysis.category}`,
        strategyUsed: 'none'
      };
    }

    return await strategy.attemptRecovery(step, analysis, page, browserController, hybridSelector, testCase);
  }

  /**
   * Attempt AI-based recovery (SelectorRecovery)
   */
  private async attemptAIRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector
  ): Promise<RecoveryResult> {
    const aiRecovery = new SelectorRecovery(this.aiServiceUrl);
    return await aiRecovery.attemptRecovery(step, analysis, page, browserController, hybridSelector);
  }
}

