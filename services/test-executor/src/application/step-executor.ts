import { TestStep, ActionType, ElementSelector, StepResult, PageState, TestCase } from '../domain/models';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { HybridSelector } from '../infrastructure/selectors/hybrid-selector';
import { FailureClassifier } from './failure-classifier';
import { RecoveryManager } from './recovery-strategies';
import { SelectorLearner } from './selector_learner';
import { retryWithBackoff } from '../../shared/utils/retry';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('step-executor');

export class StepExecutor {
  private browserController: PlaywrightController;
  private hybridSelector: HybridSelector;
  private failureClassifier: FailureClassifier;
  private recoveryManager: RecoveryManager;
  private selectorLearner: SelectorLearner;
  private aiServiceUrl: string;

  constructor(
    browserController: PlaywrightController,
    hybridSelector: HybridSelector,
    aiServiceUrl: string = 'http://localhost:8000'
  ) {
    this.browserController = browserController;
    this.hybridSelector = hybridSelector;
    this.aiServiceUrl = aiServiceUrl;
    this.failureClassifier = new FailureClassifier(aiServiceUrl);
    this.recoveryManager = new RecoveryManager(aiServiceUrl);
    this.selectorLearner = new SelectorLearner();
  }

  /**
   * Check if step action requires element location
   */
  private needsElementLocation(action: ActionType): boolean {
    return [
      ActionType.CLICK,
      ActionType.TYPE,
      ActionType.FILL,
      ActionType.HOVER,
      ActionType.ASSERT
    ].includes(action);
  }

  /**
   * Try to locate element using provided selectors
   * Returns first successful match or null if all fail
   */
  private async trySelectors(
    page: any,
    selectors: ElementSelector[],
    stepIndex?: number,
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void,
    sendSelectorAttempt?: (stepIndex: number, selector: ElementSelector, attemptNumber: number, totalAttempts: number, status: 'trying' | 'failed' | 'succeeded') => void,
    testCaseId?: string,
    stepId?: string
  ): Promise<{ selector: ElementSelector | null; found: boolean }> {
    const totalAttempts = selectors.length;
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const attemptNumber = i + 1;
      
      // Log and send event: trying selector
      if (log) log('info', `   🔍 Trying selector ${attemptNumber}/${totalAttempts}: ${selector.type} = "${selector.value}"`);
      if (sendSelectorAttempt && stepIndex !== undefined) {
        sendSelectorAttempt(stepIndex, selector, attemptNumber, totalAttempts, 'trying');
      }
      
      try {
        const locator = this.getPlaywrightLocator(page, selector);
        if (locator) {
          const count = await locator.count();
          if (count > 0) {
            const isVisible = await locator.first().isVisible().catch(() => false);
            if (isVisible) {
              // Track success
              if (testCaseId && stepId) {
                await this.selectorLearner.trackSelectorAttempt(testCaseId, stepId, selector, true)
                  .catch(() => {}); // Don't break on tracking failure
              }
              
              // Log and send event: selector succeeded
              if (log) log('info', `   ✅ Selector ${attemptNumber} succeeded: ${selector.type} = "${selector.value}"`);
              if (sendSelectorAttempt && stepIndex !== undefined) {
                sendSelectorAttempt(stepIndex, selector, attemptNumber, totalAttempts, 'succeeded');
              }
              return { selector, found: true };
            }
          }
        }
        
        // Track failure (element not visible)
        if (testCaseId && stepId) {
          await this.selectorLearner.trackSelectorAttempt(testCaseId, stepId, selector, false)
            .catch(() => {}); // Don't break on tracking failure
        }
        
        // Selector found but not visible
        if (log) log('info', `   ❌ Selector ${attemptNumber} failed: ${selector.type} = "${selector.value}" - Element not visible`);
        if (sendSelectorAttempt && stepIndex !== undefined) {
          sendSelectorAttempt(stepIndex, selector, attemptNumber, totalAttempts, 'failed');
        }
      } catch (error: any) {
        // Track failure (error occurred)
        if (testCaseId && stepId) {
          await this.selectorLearner.trackSelectorAttempt(testCaseId, stepId, selector, false)
            .catch(() => {}); // Don't break on tracking failure
        }
        
        // Selector failed with error
        if (log) log('info', `   ❌ Selector ${attemptNumber} failed: ${selector.type} = "${selector.value}" - ${error.message || 'Element not found'}`);
        if (sendSelectorAttempt && stepIndex !== undefined) {
          sendSelectorAttempt(stepIndex, selector, attemptNumber, totalAttempts, 'failed');
        }
        continue;
      }
    }
    return { selector: null, found: false };
  }

  /**
   * Get Playwright locator from selector
   */
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
        if (selector.value.includes('has-text')) {
          return page.locator(selector.value);
        }
        return null;

      case 'xpath':
        return page.locator(selector.value);

      case 'visual':
        return null;

      default:
        return null;
    }
  }

  async executeStep(
    step: TestStep,
    stepIndex: number,
    sendLog?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void,
    testCaseId?: string,
    browserStreamer?: any,
    onStepUpdated?: (step: TestStep) => void,
    testCase?: TestCase
  ): Promise<StepResult> {
    const log = sendLog || ((level: string, msg: string) => console.log(msg));
    const startTime = Date.now();
    let screenshotPath: string | undefined;
    let error: string | undefined;
    let success = false;
    let elementFound = false;
    let selectorUsed: ElementSelector | undefined;
    let attemptedSelectors: ElementSelector[] = [];
    let pageState: PageState | undefined;
    let recoveryAttempts = 0;

    // Load proven selectors from learning database and merge with AI-generated selectors
    if (testCaseId && step.id && this.needsElementLocation(step.action)) {
      try {
        const provenSelectors = await this.selectorLearner.loadProvenSelectors(testCaseId, step.id);
        if (provenSelectors.length > 0) {
          log('info', `   🧠 Loaded ${provenSelectors.length} proven selector(s) from learning database`);
          // Merge: proven selectors first (higher priority), then AI-generated
          if (step.suggested_selectors) {
            step.suggested_selectors = [...provenSelectors, ...step.suggested_selectors];
          } else {
            step.suggested_selectors = provenSelectors;
          }
        }
      } catch (error: any) {
        log('warn', `   ⚠️ Failed to load proven selectors: ${error.message}`);
        // Continue without proven selectors - don't break execution
      }
    }

    // Log Claude's suggested selectors if available
    if (step.suggested_selectors && step.suggested_selectors.length > 0) {
      log('info', `   🎯 Pre-generated Selectors (${step.suggested_selectors.length}):`);
      step.suggested_selectors.slice(0, 3).forEach((selector, idx) => {
        log('info', `      ${idx + 1}. ${selector.type} = "${selector.value}"`);
      });
      attemptedSelectors.push(...step.suggested_selectors);
    }

    try {
      switch (step.action) {
        case ActionType.NAVIGATE:
          log('info', `   🔄 Navigating to ${step.value || 'URL'}`);
          await this.executeNavigate(step);
          success = true;
          // Take screenshot immediately after navigation (skip wait since we already waited)
          try {
            screenshotPath = await this.browserController.takeScreenshot(step.id, true);
          } catch (screenshotError: any) {
            log('warn', `   ⚠️ Screenshot failed: ${screenshotError.message}`);
          }
          break;

        case ActionType.CLICK:
          log('info', `   🔄 Click action`);
          const sendSelectorAttempt = browserStreamer?.sendSelectorAttempt?.bind(browserStreamer);
          const clickResult = await this.executeClick(step, log, attemptedSelectors, stepIndex, sendSelectorAttempt, testCaseId, step.id);
          success = clickResult.success;
          elementFound = clickResult.elementFound;
          selectorUsed = clickResult.selectorUsed;
          if (clickResult.attemptedSelectors) {
            attemptedSelectors.push(...clickResult.attemptedSelectors);
          }
          if (!success) error = clickResult.error;
          break;

        case ActionType.TYPE:
        case ActionType.FILL:
          log('info', `   🔄 Type/Fill: "${step.value}"`);
          const sendSelectorAttemptType = browserStreamer?.sendSelectorAttempt?.bind(browserStreamer);
          const typeResult = await this.executeType(step, log, attemptedSelectors, stepIndex, sendSelectorAttemptType, testCaseId, step.id);
          success = typeResult.success;
          elementFound = typeResult.elementFound;
          selectorUsed = typeResult.selectorUsed;
          if (typeResult.attemptedSelectors) {
            attemptedSelectors.push(...typeResult.attemptedSelectors);
          }
          if (!success) error = typeResult.error;
          break;

        case ActionType.WAIT:
          log('info', `   ⏳ Wait ${step.wait_time || 1000}ms`);
          await this.executeWait(step);
          success = true;
          break;

        case ActionType.SCROLL:
          log('info', `   📜 Scroll`);
          await this.executeScroll(step);
          success = true;
          break;

        case ActionType.HOVER:
          log('info', `   🖱️ Hover`);
          const sendSelectorAttemptHover = browserStreamer?.sendSelectorAttempt?.bind(browserStreamer);
          const hoverResult = await this.executeHover(step, log, attemptedSelectors, stepIndex, sendSelectorAttemptHover, testCaseId, step.id);
          success = hoverResult.success;
          elementFound = hoverResult.elementFound;
          selectorUsed = hoverResult.selectorUsed;
          if (hoverResult.attemptedSelectors) {
            attemptedSelectors.push(...hoverResult.attemptedSelectors);
          }
          if (!success) error = hoverResult.error;
          break;

        case ActionType.ASSERT:
          log('info', `   ✅ Assert: ${step.expected_outcome || 'Element visible'}`);
          const sendSelectorAttemptAssert = browserStreamer?.sendSelectorAttempt?.bind(browserStreamer);
          const assertResult = await this.executeAssert(step, log, stepIndex, sendSelectorAttemptAssert, testCaseId, step.id);
          success = assertResult.success;
          if (!success) error = assertResult.error;
          break;

        default:
          error = `Unknown action type: ${step.action}`;
      }

      // Capture screenshot after step (skip if already captured, e.g., after navigation)
      if (!screenshotPath) {
        try {
          screenshotPath = await this.browserController.takeScreenshot(step.id);
        } catch (screenshotError: any) {
          log('warn', `   ⚠️ Screenshot failed: ${screenshotError.message}`);
        }
      }

    } catch (err: any) {
      error = err.message || 'Unknown error occurred';
      try {
        screenshotPath = await this.browserController.takeScreenshot(step.id);
      } catch (screenshotError: any) {
        // Ignore
      }
    }

    // Build step result
    let stepResult: StepResult = {
      step_id: step.id,
      success,
      error,
      screenshot_path: screenshotPath,
      execution_time_ms: Date.now() - startTime,
      element_found: elementFound,
      selector_used: selectorUsed,
      attempted_selectors: (attemptedSelectors && attemptedSelectors.length > 0) ? attemptedSelectors : undefined,
      page_state: pageState,
      recovery_attempts: recoveryAttempts > 0 ? recoveryAttempts : undefined
    };

    // Save successful selector to learning database
    if (testCaseId && step.id && selectorUsed && success && elementFound && step.target) {
      try {
        const html = await this.browserController.getPageHTML().catch(() => undefined);
        await this.selectorLearner.saveProvenSelector(
          testCaseId,
          step.id,
          step.target,
          selectorUsed,
          html
        );
        log('info', `   💾 Saved proven selector to learning database: ${selectorUsed.type} = "${selectorUsed.value}"`);
      } catch (error: any) {
        log('warn', `   ⚠️ Failed to save proven selector: ${error.message}`);
        // Don't throw - learning is optional, shouldn't break execution
      }
    }

    // If step failed, classify the failure and attempt recovery
    if (!success) {
      try {
        const page = await this.browserController.ensurePage();
        
        // Capture page state
        try {
          pageState = {
            url: page.url(),
            title: await page.title().catch(() => ''),
            html_snippet: (await page.content()).substring(0, 2000)
          };
          stepResult.page_state = pageState;
        } catch (e) {
          // Ignore
        }

        // Classify the failure
        const analysis = await this.failureClassifier.classifyFailure(stepResult, step, page);
        stepResult.failure_analysis = analysis;

        log('info', `   🔍 Failure Classification: ${analysis.category} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);
        log('info', `   📋 Reason: ${analysis.reason}`);
        log('info', `   🏷️  Type: ${analysis.isSystemFailure ? 'System Failure (our fault)' : 'Application Bug (developer fix needed)'}`);

        // Send agent message: analyzing
        if (browserStreamer?.sendAgentMessage) {
          browserStreamer.sendAgentMessage(stepIndex, 'analyzing', `🔍 Analyzing failure: ${analysis.reason}`);
        }

        // If it's a system failure, attempt recovery
        if (analysis.isSystemFailure && !analysis.recoveryAttempted) {
          log('info', `   🔄 First selector failed. Attempting recovery with alternative selectors...`);
          if (browserStreamer?.sendSelectorRecoveryStart) {
            browserStreamer.sendSelectorRecoveryStart(stepIndex, analysis.reason, attemptedSelectors || []);
          }
          
          // Send agent message: recovery attempt
          if (browserStreamer?.sendAgentMessage) {
            browserStreamer.sendAgentMessage(stepIndex, 'recovery_attempt', '🔄 Attempting recovery with pattern-based and AI strategies...');
          }
          
          recoveryAttempts = 1;
          
          const recoveryResult = await this.recoveryManager.attemptRecovery(
            step,
            analysis,
            page,
            this.browserController,
            this.hybridSelector,
            testCase
          );

          if (recoveryResult.success) {
            log('info', `   ✅ Recovery successful! Using selector: ${recoveryResult.selector?.type} = "${recoveryResult.selector?.value}"`);
            
            // Send agent message: recovery success
            if (browserStreamer?.sendAgentMessage) {
              browserStreamer.sendAgentMessage(
                stepIndex, 
                'recovery_success', 
                `✅ Recovery successful! Using ${recoveryResult.strategyUsed || 'recovery'} strategy. Continuing test...`
              );
            }
            
            if (browserStreamer?.sendSelectorRecoverySuccess && recoveryResult.selector) {
              browserStreamer.sendSelectorRecoverySuccess(stepIndex, recoveryResult.selector, recoveryResult.strategyUsed || 'unknown');
            }
            
            // Update step with successful selector (move to front and increase stability)
            if (recoveryResult.selector && step.suggested_selectors) {
              const successfulSelector = recoveryResult.selector;
              // Remove successful selector from array if it exists
              const updatedSelectors = step.suggested_selectors.filter(s => 
                !(s.type === successfulSelector.type && s.value === successfulSelector.value)
              );
              // Add successful selector to front with increased stability
              const enhancedSelector = {
                ...successfulSelector,
                stability_score: Math.min((successfulSelector.stability_score || 0.5) + 0.1, 1.0)
              };
              step.suggested_selectors = [enhancedSelector, ...updatedSelectors];
              log('info', `   📝 Updated step with successful selector. New order: [${enhancedSelector.type}="${enhancedSelector.value}", ...${updatedSelectors.length} others]`);
              
              // Notify that step was updated
              if (onStepUpdated) {
                onStepUpdated(step);
              }
            }
            
            // Retry the step action with recovered selector
            try {
              if (recoveryResult.selector) {
                selectorUsed = recoveryResult.selector;
                stepResult.selector_used = selectorUsed;
                
                // Execute the action again with recovered selector
                switch (step.action) {
                  case ActionType.CLICK:
                    await this.browserController.click(recoveryResult.selector.value);
                    success = true;
                    error = undefined;
                    break;
                  case ActionType.TYPE:
                  case ActionType.FILL:
                    if (step.value) {
                      await this.browserController.type(recoveryResult.selector.value, step.value);
                      success = true;
                      error = undefined;
                    }
                    break;
                  case ActionType.HOVER:
                    await this.browserController.hover(recoveryResult.selector.value);
                    success = true;
                    error = undefined;
                    break;
                }
                
                if (success) {
                  stepResult.success = true;
                  stepResult.error = undefined;
                  analysis.recoverySuccess = true;
                  analysis.recoveryAttempted = true;
                  stepResult.failure_analysis = analysis;
                  
                  // Capture success screenshot
                  try {
                    screenshotPath = await this.browserController.takeScreenshot(step.id);
                    stepResult.screenshot_path = screenshotPath;
                  } catch (e) {
                    // Ignore
                  }
                }
              }
            } catch (recoveryError: any) {
              log('warn', `   ⚠️ Recovery action failed: ${recoveryError.message}`);
              analysis.recoverySuccess = false;
              analysis.recoveryAttempted = true;
            }
          } else {
            log('warn', `   ⚠️ Recovery failed: ${recoveryResult.error}`);
            
            // Send agent message: recovery failed
            if (browserStreamer?.sendAgentMessage) {
              browserStreamer.sendAgentMessage(
                stepIndex, 
                'recovery_failed', 
                `⚠️ Recovery failed: ${recoveryResult.error}. Need your help to continue.`
              );
            }
            
            analysis.recoverySuccess = false;
            analysis.recoveryAttempted = true;
          }
          
          stepResult.failure_analysis = analysis;
          stepResult.recovery_attempts = recoveryAttempts;
        }
      } catch (classificationError: any) {
        logger.warn('Failure classification failed', { error: classificationError.message });
        // Continue with unclassified failure
      }
    }

    return stepResult;
  }

  private async executeNavigate(step: TestStep): Promise<void> {
    const url = step.value || step.target?.attributes?.href;
    if (!url) {
      throw new Error('No URL provided for navigate action');
    }

    let page: any;
    try {
      page = await this.browserController.ensurePage();
    } catch (error: any) {
      page = null;
    }

    if (page) {
      const currentUrl = page.url();
      const normalizeUrl = (u: string) => u.replace(/\/$/, '').split('#')[0];
      if (normalizeUrl(currentUrl) === normalizeUrl(url)) {
        return; // Already on target URL
      }
    }

    await this.browserController.navigate(url);
    // Navigation already waits for networkidle, no need for additional wait
  }

  private async executeClick(
    step: TestStep,
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void,
    attemptedSelectors?: ElementSelector[],
    stepIndex?: number,
    sendSelectorAttempt?: (stepIndex: number, selector: ElementSelector, attemptNumber: number, totalAttempts: number, status: 'trying' | 'failed' | 'succeeded') => void,
    testCaseId?: string,
    stepId?: string
  ): Promise<{
    success: boolean;
    elementFound: boolean;
    selectorUsed?: ElementSelector;
    attemptedSelectors?: ElementSelector[];
    error?: string;
  }> {
    if (!step.target) {
      return { success: false, elementFound: false, error: 'No target specified for click' };
    }

    let page: any;
    try {
      page = await this.browserController.ensurePage();
    } catch (error: any) {
      return { success: false, elementFound: false, error: `Browser not initialized: ${error.message}` };
    }

    const target = step.target;
    let locationResult: any = null;

    try {
      locationResult = await retryWithBackoff(
        async () => {
          // Strategy 1: Try pre-generated selectors (fast path)
          if (step.suggested_selectors && step.suggested_selectors.length > 0) {
            if (log) log('info', `   🎯 Trying pre-generated selectors`);
            if (attemptedSelectors) {
              attemptedSelectors.push(...step.suggested_selectors);
            }
            const result = await this.trySelectors(page, step.suggested_selectors, stepIndex, log, sendSelectorAttempt, testCaseId, stepId);
            if (result.found && result.selector) {
              if (log) log('info', `   ✅ Found: ${result.selector.type} = "${result.selector.value}"`);
              return result;
            } else if (log && step.suggested_selectors.length > 1) {
              log('info', `   ⚠️ First selector failed, trying alternative selectors...`);
            }
          }

          // Strategy 2: Simple DOM analysis fallback
          if (log) log('info', `   🔍 Fallback: DOM analysis`);
          const html = await this.browserController.getPageHTML();
          const screenshotPath = await this.browserController.takeScreenshot();
          const selectors = await this.hybridSelector.findElement(html, screenshotPath, target);

          if (selectors.length > 0) {
            if (attemptedSelectors) {
              attemptedSelectors.push(...selectors);
            }
            const result = await this.hybridSelector.locateElementWithSelectors(page, selectors);
            if (result.found && result.selector) {
              if (log) log('info', `   ✅ Found: ${result.selector.type} = "${result.selector.value}"`);
              return result;
            }
          }

          throw new Error('Element not found with any selector');
        },
        { maxRetries: 1, initialDelayMs: 300, maxDelayMs: 1000 }
      );
    } catch (error: any) {
                  return {
                    success: false,
                    elementFound: false,
        attemptedSelectors: attemptedSelectors,
        error: `Could not find element: ${JSON.stringify(step.target)}. ${error.message}`
      };
    }

    await this.browserController.click(locationResult.selector.value);
    return { 
      success: true, 
      elementFound: true, 
      selectorUsed: locationResult.selector,
      attemptedSelectors: (attemptedSelectors && attemptedSelectors.length > 0) ? attemptedSelectors : undefined
    };
  }

  private async executeType(
    step: TestStep,
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void,
    attemptedSelectors?: ElementSelector[],
    stepIndex?: number,
    sendSelectorAttempt?: (stepIndex: number, selector: ElementSelector, attemptNumber: number, totalAttempts: number, status: 'trying' | 'failed' | 'succeeded') => void,
    testCaseId?: string,
    stepId?: string
  ): Promise<{
    success: boolean;
    elementFound: boolean;
    selectorUsed?: ElementSelector;
    attemptedSelectors?: ElementSelector[];
    error?: string;
  }> {
    if (!step.target) {
      return { success: false, elementFound: false, error: 'No target specified for type' };
    }

    if (!step.value) {
      return { success: false, elementFound: false, error: 'No value provided for type action' };
    }

    let page: any;
    try {
      page = await this.browserController.ensurePage();
    } catch (error: any) {
      return { success: false, elementFound: false, error: `Browser not initialized: ${error.message}` };
    }

    const target = step.target;
    let locationResult: any = null;

    try {
      locationResult = await retryWithBackoff(
        async () => {
          // Strategy 1: Try pre-generated selectors
          if (step.suggested_selectors && step.suggested_selectors.length > 0) {
            if (log) log('info', `   🎯 Trying pre-generated selectors`);
            if (attemptedSelectors) {
              attemptedSelectors.push(...step.suggested_selectors);
            }
            const result = await this.trySelectors(page, step.suggested_selectors, stepIndex, log, sendSelectorAttempt, testCaseId, stepId);
            if (result.found && result.selector) {
              if (log) log('info', `   ✅ Found: ${result.selector.type} = "${result.selector.value}"`);
              return result;
            } else if (log && step.suggested_selectors.length > 1) {
              log('info', `   ⚠️ First selector failed, trying alternative selectors...`);
            }
          }

          // Strategy 2: DOM analysis fallback
          if (log) log('info', `   🔍 Fallback: DOM analysis`);
          const html = await this.browserController.getPageHTML();
          const screenshotPath = await this.browserController.takeScreenshot();
          const selectors = await this.hybridSelector.findElement(html, screenshotPath, target);

          if (selectors.length > 0) {
            if (attemptedSelectors) {
              attemptedSelectors.push(...selectors);
            }
            const result = await this.hybridSelector.locateElementWithSelectors(page, selectors);
            if (result.found && result.selector) {
              if (log) log('info', `   ✅ Found: ${result.selector.type} = "${result.selector.value}"`);
              return result;
            }
          }

          throw new Error('Element not found with any selector');
        },
        { maxRetries: 1, initialDelayMs: 300, maxDelayMs: 1000 }
      );
    } catch (error: any) {
      return {
        success: false,
        elementFound: false,
        attemptedSelectors: attemptedSelectors,
        error: `Could not find element: ${JSON.stringify(step.target)}. ${error.message}`
      };
    }

    await this.browserController.type(locationResult.selector.value, step.value);
    return { 
      success: true, 
      elementFound: true, 
      selectorUsed: locationResult.selector,
      attemptedSelectors: (attemptedSelectors && attemptedSelectors.length > 0) ? attemptedSelectors : undefined
    };
  }

  private async executeWait(step: TestStep): Promise<void> {
    const waitTime = step.wait_time || 1000;
    await this.browserController.waitForTimeout(waitTime);
  }

  private async executeScroll(step: TestStep): Promise<void> {
    if (step.target) {
      let page: any;
      try {
        page = await this.browserController.ensurePage();
      } catch (error: any) {
        throw new Error(`Browser not initialized: ${error.message}`);
      }

      const html = await this.browserController.getPageHTML();
      const screenshotPath = await this.browserController.takeScreenshot();
      const selectors = await this.hybridSelector.findElement(html, screenshotPath, step.target);
      const result = await this.hybridSelector.locateElementWithSelectors(page, selectors);

      if (result.found && result.selector) {
        await this.browserController.scroll(result.selector.value);
      } else {
        await this.browserController.scroll();
      }
    } else {
      await this.browserController.scroll();
    }
  }

  private async executeHover(
    step: TestStep,
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void,
    attemptedSelectors?: ElementSelector[],
    stepIndex?: number,
    sendSelectorAttempt?: (stepIndex: number, selector: ElementSelector, attemptNumber: number, totalAttempts: number, status: 'trying' | 'failed' | 'succeeded') => void,
    testCaseId?: string,
    stepId?: string
  ): Promise<{
    success: boolean;
    elementFound: boolean;
    selectorUsed?: ElementSelector;
    attemptedSelectors?: ElementSelector[];
    error?: string;
  }> {
    if (!step.target) {
      return { success: false, elementFound: false, error: 'No target specified for hover' };
    }

    let page: any;
    try {
      page = await this.browserController.ensurePage();
    } catch (error: any) {
      return { success: false, elementFound: false, error: `Browser not initialized: ${error.message}` };
    }

    const target = step.target;
    let locationResult: any = null;

    try {
      locationResult = await retryWithBackoff(
        async () => {
          if (step.suggested_selectors && step.suggested_selectors.length > 0) {
            if (attemptedSelectors) {
              attemptedSelectors.push(...step.suggested_selectors);
            }
              const result = await this.trySelectors(page, step.suggested_selectors, stepIndex, log, sendSelectorAttempt, testCaseId, stepId);
              if (result.found && result.selector) return result;
          }

          const html = await this.browserController.getPageHTML();
          const screenshotPath = await this.browserController.takeScreenshot();
          const selectors = await this.hybridSelector.findElement(html, screenshotPath, target);

          if (selectors.length > 0) {
            if (attemptedSelectors) {
              attemptedSelectors.push(...selectors);
            }
            const result = await this.hybridSelector.locateElementWithSelectors(page, selectors);
            if (result.found && result.selector) return result;
          }

          throw new Error('Element not found');
        },
        { maxRetries: 1, initialDelayMs: 300, maxDelayMs: 1000 }
      );
    } catch (error: any) {
      return {
        success: false,
        elementFound: false,
        attemptedSelectors: attemptedSelectors,
        error: `Could not find element: ${JSON.stringify(step.target)}. ${error.message}`
      };
    }

    await this.browserController.hover(locationResult.selector.value);
    return { 
      success: true, 
      elementFound: true, 
      selectorUsed: locationResult.selector,
      attemptedSelectors: attemptedSelectors && attemptedSelectors.length > 0 ? attemptedSelectors : undefined
    };
  }

  private async executeAssert(
    step: TestStep,
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void,
    stepIndex?: number,
    sendSelectorAttempt?: (stepIndex: number, selector: ElementSelector, attemptNumber: number, totalAttempts: number, status: 'trying' | 'failed' | 'succeeded') => void
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    let page: any;
    try {
      page = await this.browserController.ensurePage();
    } catch (error: any) {
      return { success: false, error: `Browser not initialized: ${error.message}` };
    }

    // Special handling for link collection assertions
    const expectedOutcome = (step.expected_outcome || '').toLowerCase();
    const targetText = step.target ? JSON.stringify(step.target).toLowerCase() : '';
    const isLinkAssertion =
      (expectedOutcome.includes('link') && expectedOutcome.includes('href')) ||
      (targetText.includes('link') && expectedOutcome.includes('exist'));

    if (isLinkAssertion) {
      try {
        const links = await page.locator('a').all();
        if (links.length === 0) {
          return { success: false, error: 'No links found on the page' };
        }

        let linksWithHref = 0;
        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            if (href && href.trim() !== '') linksWithHref++;
          } catch (error) {
            continue;
          }
        }

        if (linksWithHref === 0) {
          return { success: false, error: 'No links with href attributes found' };
        }

        if (log) log('info', `   ✅ Found ${linksWithHref} links with href`);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: `Error checking links: ${error.message}` };
      }
    }

    // Basic element visibility assertion
    if (step.target) {
      const target = step.target;
      let locationResult: any = null;

      try {
        locationResult = await retryWithBackoff(
          async () => {
            if (step.suggested_selectors && step.suggested_selectors.length > 0) {
              const result = await this.trySelectors(page, step.suggested_selectors, stepIndex, log, sendSelectorAttempt, testCaseId, stepId);
              if (result.found && result.selector) return result;
            }

            const html = await this.browserController.getPageHTML();
            const screenshotPath = await this.browserController.takeScreenshot();
            const selectors = await this.hybridSelector.findElement(html, screenshotPath, target);

            if (selectors.length > 0) {
              const result = await this.hybridSelector.locateElementWithSelectors(page, selectors);
              if (result.found && result.selector) return result;
            }

            throw new Error('Element not found');
          },
          { maxRetries: 1, initialDelayMs: 300, maxDelayMs: 1000 }
        );
      } catch (error: any) {
        return {
          success: false,
          error: `Assertion failed: Element not found - ${step.expected_outcome || 'Element should be visible'}`
        };
      }

      if (locationResult.selector) {
        const isVisible = await this.browserController.isVisible(locationResult.selector.value);
        if (!isVisible) {
          return {
            success: false,
            error: `Assertion failed: Element not visible - ${step.expected_outcome || 'Element should be visible'}`
          };
        }
      }

      return { success: true };
    }

    return { success: true };
  }
}
