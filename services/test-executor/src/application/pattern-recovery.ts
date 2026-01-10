import { TestStep, ElementSelector, FailureCategory, FailureAnalysis, ActionType } from '../domain/models';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { HybridSelector } from '../infrastructure/selectors/hybrid-selector';
import { RecoveryStrategy, RecoveryResult } from './recovery-strategies';
import { FlowDetector, FlowType } from './flow-detector';
import { TestCase } from '../domain/models';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('pattern-recovery');

/**
 * Pattern-based recovery strategy for basic flows (Login/CRUD)
 * Uses common patterns instead of AI for faster recovery
 */
export class PatternRecovery implements RecoveryStrategy {
  private flowDetector: FlowDetector;

  constructor() {
    this.flowDetector = new FlowDetector();
  }

  canHandle(category: FailureCategory): boolean {
    // Can handle selector failures and timing failures for basic flows
    return category === FailureCategory.SELECTOR_FAILURE || 
           category === FailureCategory.SELECTOR_INSTABILITY ||
           category === FailureCategory.TIMING_FAILURE;
  }

  async attemptRecovery(
    step: TestStep,
    analysis: FailureAnalysis,
    page: any,
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    testCase?: TestCase
  ): Promise<RecoveryResult> {
    // Only use pattern recovery for basic flows
    if (!testCase || !this.flowDetector.isBasicFlow(testCase)) {
      return {
        success: false,
        error: 'Pattern recovery only works for basic flows',
        strategyUsed: 'pattern_recovery'
      };
    }

    const flowType = this.flowDetector.detectFlowType(testCase);
    logger.info('Attempting pattern-based recovery', { 
      stepId: step.id, 
      flowType,
      action: step.action 
    });

    try {
      // Generate common selectors based on flow type and step
      const patterns = this.generatePatterns(step, flowType);
      
      if (patterns.length === 0) {
        return {
          success: false,
          error: 'No patterns available for this step',
          strategyUsed: 'pattern_recovery'
        };
      }

      // Try each pattern in priority order
      for (const pattern of patterns) {
        try {
          const locator = this.getPlaywrightLocator(page, pattern);
          if (locator) {
            const count = await locator.count();
            if (count > 0) {
              const isVisible = await locator.first().isVisible().catch(() => false);
              if (isVisible) {
                logger.info('Pattern recovery successful', { 
                  selector: pattern.value,
                  type: pattern.type 
                });
                return {
                  success: true,
                  selector: pattern,
                  strategyUsed: `pattern_recovery_${flowType}`
                };
              }
            }
          }
        } catch (e) {
          // Try next pattern
          continue;
        }
      }

      return {
        success: false,
        error: 'All patterns failed',
        strategyUsed: 'pattern_recovery'
      };
    } catch (error: any) {
      logger.error('Pattern recovery failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        strategyUsed: 'pattern_recovery'
      };
    }
  }

  /**
   * Generate common selectors based on step action and flow type
   */
  private generatePatterns(step: TestStep, flowType: FlowType): ElementSelector[] {
    const patterns: ElementSelector[] = [];

    if (flowType === 'login') {
      patterns.push(...this.getLoginPatterns(step));
    } else if (flowType === 'crud') {
      patterns.push(...this.getCrudPatterns(step));
    }

    return patterns;
  }

  /**
   * Get login-specific patterns
   */
  private getLoginPatterns(step: TestStep): ElementSelector[] {
    const patterns: ElementSelector[] = [];
    const target = step.target;
    const action = step.action;

    // Email field patterns
    if (action === ActionType.TYPE || action === ActionType.FILL) {
      const targetText = (target?.text || target?.placeholder || target?.label || '').toLowerCase();
      if (targetText.includes('email') || targetText.includes('username') || targetText.includes('user')) {
        patterns.push(
          { type: 'id', value: '#email', stability_score: 0.9 },
          { type: 'id', value: '#username', stability_score: 0.9 },
          { type: 'id', value: '#user', stability_score: 0.85 },
          { type: 'css', value: '[name="email"]', stability_score: 0.85 },
          { type: 'css', value: '[name="username"]', stability_score: 0.85 },
          { type: 'css', value: 'input[type="email"]', stability_score: 0.8 },
          { type: 'css', value: 'input[placeholder*="Email" i]', stability_score: 0.75 },
          { type: 'css', value: 'input[placeholder*="Username" i]', stability_score: 0.75 }
        );
      }
    }

    // Password field patterns
    if (action === ActionType.TYPE || action === ActionType.FILL) {
      const targetText = (target?.text || target?.placeholder || target?.label || '').toLowerCase();
      if (targetText.includes('password') || targetText.includes('pass')) {
        patterns.push(
          { type: 'id', value: '#password', stability_score: 0.9 },
          { type: 'id', value: '#pass', stability_score: 0.85 },
          { type: 'css', value: '[name="password"]', stability_score: 0.85 },
          { type: 'css', value: 'input[type="password"]', stability_score: 0.8 },
          { type: 'css', value: 'input[placeholder*="Password" i]', stability_score: 0.75 }
        );
      }
    }

    // Login button patterns
    if (action === ActionType.CLICK) {
      const targetText = (target?.text || target?.label || '').toLowerCase();
      if (targetText.includes('login') || targetText.includes('sign in') || targetText.includes('submit')) {
        patterns.push(
          { type: 'text', value: 'button:has-text("Login")', stability_score: 0.8 },
          { type: 'text', value: 'button:has-text("Sign In")', stability_score: 0.8 },
          { type: 'text', value: 'button:has-text("Log In")', stability_score: 0.8 },
          { type: 'css', value: 'button[type="submit"]', stability_score: 0.75 },
          { type: 'id', value: '#login', stability_score: 0.85 },
          { type: 'id', value: '#login-button', stability_score: 0.85 },
          { type: 'id', value: '#submit', stability_score: 0.8 },
          { type: 'css', value: 'button[role="button"]:has-text("Login")', stability_score: 0.7 }
        );
      }
    }

    return patterns;
  }

  /**
   * Get CRUD-specific patterns
   */
  private getCrudPatterns(step: TestStep): ElementSelector[] {
    const patterns: ElementSelector[] = [];
    const target = step.target;
    const action = step.action;
    const targetText = (target?.text || target?.label || '').toLowerCase();

    // Create/Add button patterns
    if (action === ActionType.CLICK && (targetText.includes('create') || targetText.includes('add') || targetText.includes('new'))) {
      patterns.push(
        { type: 'text', value: 'button:has-text("Create")', stability_score: 0.8 },
        { type: 'text', value: 'button:has-text("Add")', stability_score: 0.8 },
        { type: 'text', value: 'button:has-text("New")', stability_score: 0.75 },
        { type: 'id', value: '#create', stability_score: 0.85 },
        { type: 'id', value: '#add', stability_score: 0.85 },
        { type: 'css', value: 'button[aria-label*="Create" i]', stability_score: 0.7 }
      );
    }

    // Save/Submit button patterns
    if (action === ActionType.CLICK && (targetText.includes('save') || targetText.includes('submit'))) {
      patterns.push(
        { type: 'text', value: 'button:has-text("Save")', stability_score: 0.8 },
        { type: 'text', value: 'button:has-text("Submit")', stability_score: 0.8 },
        { type: 'css', value: 'button[type="submit"]', stability_score: 0.75 },
        { type: 'id', value: '#save', stability_score: 0.85 },
        { type: 'id', value: '#submit', stability_score: 0.85 }
      );
    }

    // Delete/Remove button patterns
    if (action === ActionType.CLICK && (targetText.includes('delete') || targetText.includes('remove'))) {
      patterns.push(
        { type: 'text', value: 'button:has-text("Delete")', stability_score: 0.8 },
        { type: 'text', value: 'button:has-text("Remove")', stability_score: 0.8 },
        { type: 'id', value: '#delete', stability_score: 0.85 },
        { type: 'id', value: '#remove', stability_score: 0.85 },
        { type: 'css', value: 'button[aria-label*="Delete" i]', stability_score: 0.7 }
      );
    }

    return patterns;
  }

  /**
   * Get Playwright locator from selector
   */
  private getPlaywrightLocator(page: any, selector: ElementSelector): any {
    switch (selector.type) {
      case 'id':
        // Handle both #id and id formats
        const idValue = selector.value.startsWith('#') ? selector.value : `#${selector.value}`;
        return page.locator(idValue);
      
      case 'name':
        return page.locator(selector.value);
      
      case 'css':
        return page.locator(selector.value);
      
      case 'text':
        // Extract text from selector value like 'button:has-text("Login")'
        const textMatch = selector.value.match(/has-text\("(.+)"\)/);
        if (textMatch) {
          return page.getByText(textMatch[1], { exact: false });
        }
        // Try as direct text selector
        if (selector.value.includes(':')) {
          return page.locator(selector.value);
        }
        return page.getByText(selector.value, { exact: false });
      
      case 'aria-label':
        return page.locator(`[aria-label="${selector.value}"]`);
      
      default:
        return null;
    }
  }
}




