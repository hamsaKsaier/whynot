import { TestStep, ActionType, ElementSelector, StepResult } from '../domain/models';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { HybridSelector } from '../infrastructure/selectors/hybrid-selector';
import { retryWithBackoff } from '../../shared/utils/retry';
import * as path from 'path';

export class StepExecutor {
  private browserController: PlaywrightController;
  private hybridSelector: HybridSelector;

  constructor(
    browserController: PlaywrightController,
    hybridSelector: HybridSelector
  ) {
    this.browserController = browserController;
    this.hybridSelector = hybridSelector;
  }

  /**
   * Try to locate element using provided selectors
   * Returns first successful match or null if all fail
   */
  private async trySelectors(
    page: any,
    selectors: ElementSelector[]
  ): Promise<{ selector: ElementSelector | null; found: boolean }> {
    for (const selector of selectors) {
      try {
        const locator = this.getPlaywrightLocator(page, selector);
        if (locator) {
          const count = await locator.count();
          if (count > 0) {
            const isVisible = await locator.first().isVisible().catch(() => false);
            if (isVisible) {
              return { selector, found: true };
            }
          }
        }
      } catch (error) {
        // Try next selector
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
        // Extract text from value
        const textMatch = selector.value.match(/text="(.+)"/);
        if (textMatch) {
          return page.getByText(textMatch[1], { exact: false });
        }
        // Try direct text match
        if (selector.value.includes('has-text')) {
          return page.locator(selector.value);
        }
        return null;

      case 'xpath':
        return page.locator(selector.value);

      case 'visual':
        // Visual selectors need special handling
        return null;

      default:
        return null;
    }
  }

  async executeStep(step: TestStep, stepIndex: number, sendLog?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void): Promise<StepResult> {
    // Use sendLog if provided, otherwise fallback to console.log
    const log = sendLog || ((level: string, msg: string) => console.log(msg));
    const startTime = Date.now();
    let screenshotPath: string | undefined;
    let error: string | undefined;
    let success = false;
    let elementFound = false;
    let selectorUsed: ElementSelector | undefined;

    try {
      switch (step.action) {
        case ActionType.NAVIGATE:
          log('info', `   🔄 Executing: Navigate to ${step.value || 'URL'}`);
          await this.executeNavigate(step);
          success = true;
          break;

        case ActionType.CLICK:
          log('info', `   🔄 Executing: Click action`);
          log('info', `   🔍 Locating element...`);
          const clickResult = await this.executeClick(step, log);
          success = clickResult.success;
          elementFound = clickResult.elementFound;
          selectorUsed = clickResult.selectorUsed;
          if (!success) {
            error = clickResult.error;
          }
          break;

        case ActionType.TYPE:
        case ActionType.FILL:
          log('info', `   🔄 Executing: Type/Fill action`);
          log('info', `   📝 Value to type: "${step.value}"`);
          log('info', `   🔍 Locating input element...`);
          const typeResult = await this.executeType(step, log);
          success = typeResult.success;
          elementFound = typeResult.elementFound;
          selectorUsed = typeResult.selectorUsed;
          if (!success) {
            error = typeResult.error;
          }
          break;

        case ActionType.WAIT:
          log('info', `   ⏳ Waiting ${step.wait_time || 1000}ms...`);
          await this.executeWait(step);
          success = true;
          break;

        case ActionType.SCROLL:
          log('info', `   📜 Executing: Scroll action`);
          await this.executeScroll(step);
          success = true;
          break;

        case ActionType.HOVER:
          log('info', `   🖱️  Executing: Hover action`);
          log('info', `   🔍 Locating element...`);
          const hoverResult = await this.executeHover(step, log);
          success = hoverResult.success;
          elementFound = hoverResult.elementFound;
          selectorUsed = hoverResult.selectorUsed;
          if (!success) {
            error = hoverResult.error;
          }
          break;

        case ActionType.ASSERT:
          log('info', `   ✅ Executing: Assertion`);
          log('info', `   🔍 Verifying: ${step.expected_outcome || 'Element visibility'}`);
          const assertResult = await this.executeAssert(step, log);
          success = assertResult.success;
          if (!success) {
            error = assertResult.error;
          }
          break;

        default:
          error = `Unknown action type: ${step.action}`;
      }

      // Capture screenshot after step execution
      screenshotPath = await this.browserController.takeScreenshot(step.id);

    } catch (err: any) {
      error = err.message || 'Unknown error occurred';
      screenshotPath = await this.browserController.takeScreenshot(step.id);
    }

    const executionTime = Date.now() - startTime;

    return {
      step_id: step.id,
      success,
      error,
      screenshot_path: screenshotPath,
      execution_time_ms: executionTime,
      element_found: elementFound,
      selector_used: selectorUsed
    };
  }

  private async executeNavigate(step: TestStep): Promise<void> {
    const url = step.value || step.target?.attributes?.href;
    if (!url) {
      throw new Error('No URL provided for navigate action');
    }
    await this.browserController.navigate(url);
  }

  private async executeClick(step: TestStep, log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void): Promise<{
    success: boolean;
    elementFound: boolean;
    selectorUsed?: ElementSelector;
    error?: string;
  }> {
    if (!step.target) {
      return { success: false, elementFound: false, error: 'No target specified for click' };
    }

    const page = this.browserController.getPage();
    if (!page) {
      return { success: false, elementFound: false, error: 'Browser not initialized' };
    }

    // Retry element finding (elements may be dynamically loaded)
    let locationResult: any = null;
    let selectorStrategy = 'hybrid'; // Track which strategy succeeded

    // Store target in const to satisfy TypeScript (we already checked it's not null)
    const target = step.target;

    try {
      locationResult = await retryWithBackoff(
        async () => {
          // Step 1: Try Claude's suggested selectors first (if available)
          if (step.suggested_selectors && step.suggested_selectors.length > 0) {
            if (log) log('info', `   🎯 Strategy: Trying Claude's suggested selectors (${step.suggested_selectors.length} selectors)`);
            const claudeResult = await this.trySelectors(page, step.suggested_selectors);
            if (claudeResult.found && claudeResult.selector) {
              selectorStrategy = 'claude';
              if (log) log('info', `   ✅ Element found using Claude's selector: ${claudeResult.selector.type} = "${claudeResult.selector.value}"`);
              return claudeResult;
            } else {
              if (log) log('warn', `   ⚠️  Claude's selectors didn't match, falling back to hybrid selector...`);
            }
          }

          // Step 2: Fall back to HybridSelector if Claude's selectors failed
          if (log) log('info', `   🔍 Strategy: Using Hybrid Selector (DOM + Vision analysis)`);
          const html = await this.browserController.getPageHTML();
          const screenshotPath = await this.browserController.takeScreenshot();

          const selectors = await this.hybridSelector.findElement(
            html,
            screenshotPath,
            target
          );

          if (selectors.length === 0) {
            throw new Error('No selectors found for element');
          }

          if (log) log('info', `   📋 Found ${selectors.length} potential selectors, trying in priority order...`);

          // Try to locate element using HybridSelector
          const result = await this.hybridSelector.locateElementWithSelectors(
            page,
            selectors
          );

          if (!result.found || !result.selector) {
            throw new Error('Element not found with any selector');
          }

          selectorStrategy = 'hybrid';
          if (log) log('info', `   ✅ Element found using hybrid selector: ${result.selector.type} = "${result.selector.value}" (stability: ${result.selector.stability_score})`);
          return result;
        },
        {
          maxRetries: 2,
          initialDelayMs: 500,
          maxDelayMs: 2000,
          retryableErrors: (error: any) => {
            // Retry if element not found (might be loading)
            return error.message?.includes('not found') ||
              error.message?.includes('No selectors');
          }
        }
      );
    } catch (error: any) {
      return {
        success: false,
        elementFound: false,
        error: `Could not find element after retries: ${JSON.stringify(step.target)}. Strategy tried: ${step.suggested_selectors ? 'claude->hybrid' : 'hybrid'}. ${error.message || ''}`
      };
    }

    // Click using the found selector
    const selectorValue = locationResult.selector.value;
    await this.browserController.click(selectorValue);

    return {
      success: true,
      elementFound: true,
      selectorUsed: locationResult.selector
    };
  }

  private async executeType(step: TestStep, log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void): Promise<{
    success: boolean;
    elementFound: boolean;
    selectorUsed?: ElementSelector;
    error?: string;
  }> {
    if (!step.target) {
      return { success: false, elementFound: false, error: 'No target specified for type' };
    }

    if (!step.value) {
      return { success: false, elementFound: false, error: 'No value provided for type action' };
    }

    const page = this.browserController.getPage();
    if (!page) {
      return { success: false, elementFound: false, error: 'Browser not initialized' };
    }

    // Retry element finding (elements may be dynamically loaded)
    let locationResult: any = null;
    let selectorStrategy = 'hybrid';

    // Store target in const to satisfy TypeScript (we already checked it's not null)
    const target = step.target;

    try {
      locationResult = await retryWithBackoff(
        async () => {
          // Step 1: Try Claude's suggested selectors first (if available)
          if (step.suggested_selectors && step.suggested_selectors.length > 0) {
            if (log) log('info', `   🎯 Strategy: Trying Claude's suggested selectors (${step.suggested_selectors.length} selectors)`);
            const claudeResult = await this.trySelectors(page, step.suggested_selectors);
            if (claudeResult.found && claudeResult.selector) {
              selectorStrategy = 'claude';
              if (log) log('info', `   ✅ Element found using Claude's selector: ${claudeResult.selector.type} = "${claudeResult.selector.value}"`);
              return claudeResult;
            } else {
              if (log) log('warn', `   ⚠️  Claude's selectors didn't match, falling back to hybrid selector...`);
            }
          }

          // Step 2: Fall back to HybridSelector if Claude's selectors failed
          if (log) log('info', `   🔍 Strategy: Using Hybrid Selector (DOM + Vision analysis)`);
          const html = await this.browserController.getPageHTML();
          const screenshotPath = await this.browserController.takeScreenshot();

          const selectors = await this.hybridSelector.findElement(
            html,
            screenshotPath,
            target
          );

          if (selectors.length === 0) {
            throw new Error('No selectors found for element');
          }

          if (log) log('info', `   📋 Found ${selectors.length} potential selectors, trying in priority order...`);

          // Try to locate element using HybridSelector
          const result = await this.hybridSelector.locateElementWithSelectors(
            page,
            selectors
          );

          if (!result.found || !result.selector) {
            throw new Error('Element not found with any selector');
          }

          selectorStrategy = 'hybrid';
          if (log) log('info', `   ✅ Element found using hybrid selector: ${result.selector.type} = "${result.selector.value}" (stability: ${result.selector.stability_score})`);
          return result;
        },
        {
          maxRetries: 2,
          initialDelayMs: 500,
          maxDelayMs: 2000,
          retryableErrors: (error: any) => {
            // Retry if element not found (might be loading)
            return error.message?.includes('not found') ||
              error.message?.includes('No selectors');
          }
        }
      );
    } catch (error: any) {
      return {
        success: false,
        elementFound: false,
        error: `Could not find element after retries: ${JSON.stringify(step.target)}. Strategy tried: ${step.suggested_selectors ? 'claude->hybrid' : 'hybrid'}. ${error.message || ''}`
      };
    }

    if (!locationResult.found || !locationResult.selector) {
      return {
        success: false,
        elementFound: false,
        error: `Could not find element: ${JSON.stringify(step.target)}`
      };
    }

    // Type into the element
    const selectorValue = locationResult.selector.value;
    await this.browserController.type(selectorValue, step.value);

    return {
      success: true,
      elementFound: true,
      selectorUsed: locationResult.selector
    };
  }

  private async executeWait(step: TestStep): Promise<void> {
    const waitTime = step.wait_time || 1000;
    await this.browserController.waitForTimeout(waitTime);
  }

  private async executeScroll(step: TestStep): Promise<void> {
    if (step.target) {
      const page = this.browserController.getPage();
      if (!page) {
        throw new Error('Browser not initialized');
      }

      const html = await this.browserController.getPageHTML();
      const screenshotPath = await this.browserController.takeScreenshot();

      const selectors = await this.hybridSelector.findElement(
        html,
        screenshotPath,
        step.target
      );

      const locationResult = await this.hybridSelector.locateElementWithSelectors(
        page,
        selectors
      );

      if (locationResult.found && locationResult.selector) {
        await this.browserController.scroll(locationResult.selector.value);
      } else {
        await this.browserController.scroll();
      }
    } else {
      await this.browserController.scroll();
    }
  }

  private async executeHover(step: TestStep, log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void): Promise<{
    success: boolean;
    elementFound: boolean;
    selectorUsed?: ElementSelector;
    error?: string;
  }> {
    if (!step.target) {
      return { success: false, elementFound: false, error: 'No target specified for hover' };
    }

    const page = this.browserController.getPage();
    if (!page) {
      return { success: false, elementFound: false, error: 'Browser not initialized' };
    }

    // Retry element finding
    let locationResult: any = null;

    // Store target in const to satisfy TypeScript (we already checked it's not null)
    const target = step.target;

    try {
      locationResult = await retryWithBackoff(
        async () => {
          // Step 1: Try Claude's suggested selectors first (if available)
          if (step.suggested_selectors && step.suggested_selectors.length > 0) {
            if (log) log('info', `   🎯 Strategy: Trying Claude's suggested selectors (${step.suggested_selectors.length} selectors)`);
            const claudeResult = await this.trySelectors(page, step.suggested_selectors);
            if (claudeResult.found && claudeResult.selector) {
              if (log) log('info', `   ✅ Element found using Claude's selector: ${claudeResult.selector.type} = "${claudeResult.selector.value}"`);
              return claudeResult;
            } else {
              if (log) log('warn', `   ⚠️  Claude's selectors didn't match, falling back to hybrid selector...`);
            }
          }

          // Step 2: Fall back to HybridSelector
          if (log) log('info', `   🔍 Strategy: Using Hybrid Selector (DOM + Vision analysis)`);
          const html = await this.browserController.getPageHTML();
          const screenshotPath = await this.browserController.takeScreenshot();

          const selectors = await this.hybridSelector.findElement(
            html,
            screenshotPath,
            target
          );

          if (selectors.length === 0) {
            throw new Error('No selectors found for element');
          }

          if (log) log('info', `   📋 Found ${selectors.length} potential selectors, trying in priority order...`);

          const result = await this.hybridSelector.locateElementWithSelectors(
            page,
            selectors
          );

          if (!result.found || !result.selector) {
            throw new Error('Element not found with any selector');
          }

          if (log) log('info', `   ✅ Element found using hybrid selector: ${result.selector.type} = "${result.selector.value}" (stability: ${result.selector.stability_score})`);
          return result;
        },
        {
          maxRetries: 2,
          initialDelayMs: 500,
          maxDelayMs: 2000
        }
      );
    } catch (error: any) {
      return {
        success: false,
        elementFound: false,
        error: `Could not find element after retries: ${JSON.stringify(step.target)}. Strategy tried: ${step.suggested_selectors ? 'claude->hybrid' : 'hybrid'}. ${error.message || ''}`
      };
    }

    await this.browserController.hover(locationResult.selector.value);

    return {
      success: true,
      elementFound: true,
      selectorUsed: locationResult.selector
    };
  }

  private async executeAssert(step: TestStep, log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void): Promise<{
    success: boolean;
    error?: string;
  }> {
    // Basic assertion - check if element is visible
    if (step.target) {
      const page = this.browserController.getPage();
      if (!page) {
        return { success: false, error: 'Browser not initialized' };
      }

      // Retry element finding for assertions
      let locationResult: any = null;

      // Store target in const to satisfy TypeScript (we already checked it exists)
      const target = step.target;

      try {
        locationResult = await retryWithBackoff(
          async () => {
            // Step 1: Try Claude's suggested selectors first (if available)
            if (step.suggested_selectors && step.suggested_selectors.length > 0) {
              if (log) log('info', `   🎯 Strategy: Trying Claude's suggested selectors (${step.suggested_selectors.length} selectors)`);
              const claudeResult = await this.trySelectors(page, step.suggested_selectors);
              if (claudeResult.found && claudeResult.selector) {
                if (log) log('info', `   ✅ Element found using Claude's selector: ${claudeResult.selector.type} = "${claudeResult.selector.value}"`);
                return claudeResult;
              } else {
                if (log) log('warn', `   ⚠️  Claude's selectors didn't match, falling back to hybrid selector...`);
              }
            }

            // Step 2: Fall back to HybridSelector
            if (log) log('info', `   🔍 Strategy: Using Hybrid Selector (DOM + Vision analysis)`);
            const html = await this.browserController.getPageHTML();
            const screenshotPath = await this.browserController.takeScreenshot();

            const selectors = await this.hybridSelector.findElement(
              html,
              screenshotPath,
              target
            );

            if (selectors.length === 0) {
              throw new Error('No selectors found for element');
            }

            if (log) log('info', `   📋 Found ${selectors.length} potential selectors, trying in priority order...`);

            const result = await this.hybridSelector.locateElementWithSelectors(
              page,
              selectors
            );

            if (!result.found) {
              throw new Error('Element not found with any selector');
            }

            if (log) log('info', `   ✅ Element found using hybrid selector: ${result.selector?.type} = "${result.selector?.value}" (stability: ${result.selector?.stability_score})`);
            return result;
          },
          {
            maxRetries: 2,
            initialDelayMs: 500,
            maxDelayMs: 2000
          }
        );
      } catch (error: any) {
        return {
          success: false,
          error: `Assertion failed: Element not found after retries - ${step.expected_outcome || 'Element should be visible'}. ${error.message || ''}`
        };
      }

      // Check visibility
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

