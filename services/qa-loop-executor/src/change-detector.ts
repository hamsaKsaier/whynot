import { createLogger } from '../../shared/logger/logger';
import { QALoopRepository, QALoopPage } from './repositories/qa-loop-repository';
import axios from 'axios';
import crypto from 'crypto';

const logger = createLogger('change-detector');

export interface ChangeDetectionResult {
  changedPages: PageChange[];
  newPages: DiscoveredPage[];
  removedPages: string[];
  unchangedCount: number;
  totalChecked: number;
  detectionDurationMs: number;
}

export interface PageChange {
  url: string;
  title?: string;
  changeType: 'content' | 'structure' | 'style' | 'removed';
  severity: 'low' | 'medium' | 'high';
  oldHash: string;
  newHash: string;
  diffDetails?: {
    addedElements: number;
    removedElements: number;
    modifiedElements: number;
  };
}

export interface DiscoveredPage {
  url: string;
  title?: string;
  discoveredFrom: string;
  priority: number;
}

export class ChangeDetector {
  private sessionId: string;
  private repository: QALoopRepository;
  private testExecutorUrl: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.testExecutorUrl = process.env.TEST_EXECUTOR_URL || 'http://localhost:3001';
  }

  async detectChanges(): Promise<ChangeDetectionResult> {
    const startTime = Date.now();
    logger.info('Starting change detection', { sessionId: this.sessionId });

    const knownPages = await this.repository.getExploredPages(this.sessionId);
    const changedPages: PageChange[] = [];
    const newPages: DiscoveredPage[] = [];
    const removedPages: string[] = [];
    let unchangedCount = 0;

    // Track all discovered URLs to find new ones
    const discoveredUrls = new Set<string>();

    for (const page of knownPages) {
      try {
        const result = await this.checkPage(page);

        if (result.status === 'unchanged') {
          unchangedCount++;
        } else if (result.status === 'changed') {
          changedPages.push(result.change!);
        } else if (result.status === 'removed') {
          removedPages.push(page.url);
        }

        // Track discovered URLs
        if (result.discoveredUrls) {
          result.discoveredUrls.forEach(url => discoveredUrls.add(url));
        }

      } catch (error: any) {
        logger.warn('Failed to check page', { url: page.url, error: error.message });
      }
    }

    // Find new pages (discovered URLs not in known pages)
    const knownUrls = new Set(knownPages.map(p => p.url));
    for (const url of discoveredUrls) {
      if (!knownUrls.has(url)) {
        newPages.push({
          url,
          discoveredFrom: 'change_detection',
          priority: 50
        });
      }
    }

    const detectionDurationMs = Date.now() - startTime;

    const result: ChangeDetectionResult = {
      changedPages,
      newPages: newPages.slice(0, 50), // Limit to 50 new pages
      removedPages,
      unchangedCount,
      totalChecked: knownPages.length,
      detectionDurationMs
    };

    logger.info('Change detection complete', {
      sessionId: this.sessionId,
      changedCount: changedPages.length,
      newCount: newPages.length,
      removedCount: removedPages.length,
      unchangedCount,
      durationMs: detectionDurationMs
    });

    return result;
  }

  private async checkPage(page: QALoopPage): Promise<{
    status: 'unchanged' | 'changed' | 'removed' | 'error';
    change?: PageChange;
    discoveredUrls?: string[];
  }> {
    try {
      // Fetch current page state
      const response = await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
        url: page.url,
        timeout: 30000,
        includeScreenshot: false
      }, {
        timeout: 45000
      });

      const currentHtml = response.data.html || '';
      const currentHash = crypto.createHash('sha256').update(currentHtml).digest('hex');

      // Extract links for discovering new pages
      const discoveredUrls = this.extractLinks(currentHtml, page.url);

      // Compare hashes
      if (page.html_hash && currentHash !== page.html_hash) {
        const severity = this.calculateChangeSeverity(page, currentHtml);

        return {
          status: 'changed',
          change: {
            url: page.url,
            title: response.data.title,
            changeType: 'content',
            severity,
            oldHash: page.html_hash,
            newHash: currentHash
          },
          discoveredUrls
        };
      }

      return { status: 'unchanged', discoveredUrls };

    } catch (error: any) {
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return { status: 'removed' };
      }
      return { status: 'error' };
    }
  }

  private calculateChangeSeverity(
    page: QALoopPage,
    newHtml: string
  ): 'low' | 'medium' | 'high' {
    // Simple heuristic based on page type and content size change
    const pageType = page.page_type || 'other';

    // Forms and login pages are more critical
    if (['form', 'login', 'checkout'].includes(pageType)) {
      return 'high';
    }

    // Compare content size
    const oldElements = page.discovered_elements;
    const hasStructuralChange = this.detectStructuralChange(oldElements, newHtml);

    if (hasStructuralChange) {
      return 'medium';
    }

    return 'low';
  }

  private detectStructuralChange(
    oldElements: Record<string, any>,
    newHtml: string
  ): boolean {
    // Simple check: count buttons and forms
    const buttonCount = (newHtml.match(/<button/gi) || []).length;
    const formCount = (newHtml.match(/<form/gi) || []).length;
    const inputCount = (newHtml.match(/<input/gi) || []).length;

    const oldButtonCount = oldElements?.buttons?.length || 0;
    const oldFormCount = oldElements?.forms?.length || 0;
    const oldInputCount = oldElements?.inputs?.length || 0;

    // Significant change if any element type count changes by more than 30%
    const significantChange = (oldCount: number, newCount: number) => {
      if (oldCount === 0) return newCount > 0;
      return Math.abs(newCount - oldCount) / oldCount > 0.3;
    };

    return significantChange(oldButtonCount, buttonCount) ||
      significantChange(oldFormCount, formCount) ||
      significantChange(oldInputCount, inputCount);
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
          continue;
        }

        const url = new URL(href, baseUrl);
        const base = new URL(baseUrl);

        // Only include same-origin links
        if (url.origin === base.origin) {
          // Normalize URL
          url.hash = '';
          links.push(url.href);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    return [...new Set(links)];
  }

  /**
   * Get tests affected by detected changes
   */
  async getAffectedTests(changes: ChangeDetectionResult): Promise<string[]> {
    const testCases = await this.repository.getTestCases(this.sessionId, { active: true });
    const changedUrls = new Set([
      ...changes.changedPages.map(p => p.url),
      ...changes.removedPages
    ]);

    const affectedTestIds: string[] = [];

    for (const testCase of testCases) {
      // Check if test case's source page changed
      if (testCase.source_page_url && changedUrls.has(testCase.source_page_url)) {
        affectedTestIds.push(testCase.id);
        continue;
      }

      // Check if any step navigates to a changed page
      const hasAffectedStep = testCase.steps.some((step: any) => {
        if (step.action === 'navigate' && step.target) {
          return changedUrls.has(step.target);
        }
        return false;
      });

      if (hasAffectedStep) {
        affectedTestIds.push(testCase.id);
      }
    }

    return affectedTestIds;
  }
}
