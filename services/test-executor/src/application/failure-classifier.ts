import { StepResult, TestStep, FailureAnalysis, FailureCategory, PageState } from '../domain/models';
import axios from 'axios';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('failure-classifier');

export class FailureClassifier {
  private aiServiceUrl: string;

  constructor(aiServiceUrl: string = 'http://localhost:8000') {
    this.aiServiceUrl = aiServiceUrl;
  }

  /**
   * Classify a failure to determine if it's our fault or app bug
   */
  async classifyFailure(
    stepResult: StepResult,
    step: TestStep,
    page: any
  ): Promise<FailureAnalysis> {
    // Gather context
    const context = await this.gatherContext(stepResult, step, page);
    
    // Analyze based on error type
    const quickAnalysis = this.quickClassify(stepResult, context);
    
    // If ambiguous, use AI analysis
    if (quickAnalysis.confidence < 0.7) {
      return await this.aiClassify(stepResult, step, context);
    }
    
    return quickAnalysis;
  }

  /**
   * Quick classification based on error patterns
   */
  private quickClassify(
    stepResult: StepResult,
    context: any
  ): FailureAnalysis {
    const error = stepResult.error?.toLowerCase() || '';
    
    // System failures (our fault)
    if (error.includes('element not found') && (!stepResult.attempted_selectors || stepResult.attempted_selectors.length === 0)) {
      return {
        category: FailureCategory.SELECTOR_FAILURE,
        confidence: 0.9,
        isSystemFailure: true,
        reason: 'No selectors were attempted - selector generation failed',
        suggestedActions: ['Retry with different selector strategy', 'Use AI recovery'],
        recoveryAttempted: false
      };
    }

    if (error.includes('element not found') && stepResult.attempted_selectors && stepResult.attempted_selectors.length > 0) {
      // All selectors were tried but none worked
      return {
        category: FailureCategory.SELECTOR_FAILURE,
        confidence: 0.85,
        isSystemFailure: true,
        reason: `All ${stepResult.attempted_selectors.length} selectors failed to locate element`,
        suggestedActions: ['Try AI recovery with new selectors', 'Check if element exists in DOM', 'Verify page state'],
        recoveryAttempted: false
      };
    }
    
    if (error.includes('timeout') || error.includes('waiting') || error.includes('timed out')) {
      return {
        category: FailureCategory.TIMING_FAILURE,
        confidence: 0.85,
        isSystemFailure: true,
        reason: 'Element not ready within timeout period',
        suggestedActions: ['Increase wait time', 'Add explicit wait conditions', 'Check if page is still loading'],
        recoveryAttempted: false
      };
    }

    if (error.includes('navigation') || error.includes('page load')) {
      return {
        category: FailureCategory.PAGE_LOAD_FAILURE,
        confidence: 0.8,
        isSystemFailure: true,
        reason: 'Page did not load properly',
        suggestedActions: ['Retry navigation', 'Check network connectivity', 'Verify URL is correct'],
        recoveryAttempted: false
      };
    }
    
    // Application failures (legitimate bugs)
    if (stepResult.element_found === true && (error.includes('not visible') || error.includes('not visible'))) {
      return {
        category: FailureCategory.ELEMENT_NOT_VISIBLE,
        confidence: 0.9,
        isSystemFailure: false,
        reason: 'Element exists in DOM but is not visible to user',
        suggestedActions: ['Report to developer - UI element visibility issue'],
        recoveryAttempted: false
      };
    }
    
    if (stepResult.element_found === true && (error.includes('not interactable') || error.includes('not clickable') || error.includes('disabled'))) {
      return {
        category: FailureCategory.ELEMENT_NOT_INTERACTABLE,
        confidence: 0.9,
        isSystemFailure: false,
        reason: 'Element exists but cannot be interacted with (covered, disabled, etc.)',
        suggestedActions: ['Report to developer - element interaction blocked'],
        recoveryAttempted: false
      };
    }

    if (stepResult.element_found === false && context.elementExistsInDOM === false) {
      return {
        category: FailureCategory.ELEMENT_MISSING,
        confidence: 0.85,
        isSystemFailure: false,
        reason: 'Element does not exist in the DOM at all',
        suggestedActions: ['Report to developer - element missing from page'],
        recoveryAttempted: false
      };
    }

    if (error.includes('assertion') || error.includes('expected') || error.includes('verify')) {
      return {
        category: FailureCategory.ASSERTION_FAILURE,
        confidence: 0.8,
        isSystemFailure: false,
        reason: 'Expected condition was not met',
        suggestedActions: ['Report to developer - assertion failed', 'Verify expected behavior'],
        recoveryAttempted: false
      };
    }
    
    // Ambiguous - needs AI analysis
    return {
      category: FailureCategory.UNKNOWN,
      confidence: 0.3,
      isSystemFailure: false,
      reason: 'Unable to determine failure cause automatically',
      suggestedActions: ['Use AI analysis to determine root cause', 'Review screenshot and page state'],
      recoveryAttempted: false
    };
  }

  /**
   * Use AI to classify ambiguous failures
   */
  private async aiClassify(
    stepResult: StepResult,
    step: TestStep,
    context: any
  ): Promise<FailureAnalysis> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/analyze-failure`,
        {
          step_id: stepResult.step_id,
          step_description: step.description,
          error_message: stepResult.error,
          element_found: stepResult.element_found,
          attempted_selectors: stepResult.attempted_selectors || [],
          page_state: stepResult.page_state,
          target_description: step.target,
          screenshot_base64: context.screenshot_base64
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const analysis = response.data;
      return {
        category: analysis.category as FailureCategory || FailureCategory.UNKNOWN,
        confidence: analysis.confidence || 0.5,
        isSystemFailure: analysis.is_system_failure || false,
        reason: analysis.reason || 'AI analysis completed',
        suggestedActions: analysis.suggested_actions || [],
        recoveryAttempted: false
      };
    } catch (error: any) {
      logger.warn('AI classification failed, using fallback', { error: error.message });
      // Fallback to unknown
      return {
        category: FailureCategory.UNKNOWN,
        confidence: 0.3,
        isSystemFailure: false,
        reason: `AI analysis failed: ${error.message}`,
        suggestedActions: ['Manual review required'],
        recoveryAttempted: false
      };
    }
  }

  /**
   * Gather context about the failure
   */
  private async gatherContext(
    stepResult: StepResult,
    step: TestStep,
    page: any
  ): Promise<any> {
    const context: any = {
      elementExistsInDOM: stepResult.element_found || false,
      attemptedSelectorsCount: stepResult.attempted_selectors?.length || 0
    };

    try {
      if (page) {
        context.url = page.url();
        context.title = await page.title().catch(() => '');
        
        // Check if element exists in DOM (even if not visible)
        if (step.target) {
          try {
            const html = await page.content();
            context.htmlSnippet = html.substring(0, 2000);
            context.elementExistsInDOM = this.checkElementInHTML(html, step.target);
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to gather context', { error });
    }

    return context;
  }

  /**
   * Check if element exists in HTML (basic check)
   */
  private checkElementInHTML(html: string, target: any): boolean {
    if (!target) return false;
    
    const htmlLower = html.toLowerCase();
    
    // Check for text
    if (target.text) {
      if (htmlLower.includes(target.text.toLowerCase())) {
        return true;
      }
    }
    
    // Check for role
    if (target.role) {
      if (htmlLower.includes(`role="${target.role}"`)) {
        return true;
      }
    }
    
    // Check for label
    if (target.label) {
      if (htmlLower.includes(target.label.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
}






