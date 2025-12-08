import { ElementSelector, ElementDescription } from '../../domain/models';
import { DOMAnalyzer } from './dom-analyzer';
import axios from 'axios';

export interface VisionAnalysisResult {
  elements: Array<{
    type: string;
    text?: string;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
}

export class HybridSelector {
  private domAnalyzer: DOMAnalyzer;
  private aiServiceUrl: string;

  constructor(aiServiceUrl: string = 'http://localhost:8000') {
    this.domAnalyzer = new DOMAnalyzer();
    this.aiServiceUrl = aiServiceUrl;
  }

  /**
   * Find element using hybrid strategy (DOM + Vision)
   */
  async findElement(
    html: string,
    screenshotPath: string,
    targetDescription: ElementDescription
  ): Promise<ElementSelector[]> {
    // 1. DOM Analysis
    const domSelectors = this.domAnalyzer.analyzeHTML(html, targetDescription);

    // 2. Vision Analysis (if screenshot available)
    let visionSelectors: ElementSelector[] = [];
    if (screenshotPath) {
      try {
        visionSelectors = await this.analyzeWithVision(screenshotPath, targetDescription);
      } catch (error) {
        console.warn('Vision analysis failed:', error);
      }
    }

    // 3. Combine and rank selectors
    const combined = this.combineSelectors(domSelectors, visionSelectors, targetDescription);

    // 4. Remove duplicates and sort by stability
    return this.deduplicateAndRank(combined);
  }

  private async analyzeWithVision(
    screenshotPath: string,
    targetDescription: ElementDescription
  ): Promise<ElementSelector[]> {
    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const formData = new FormData();
      formData.append('file', fs.createReadStream(screenshotPath));

      const response = await axios.post(
        `${this.aiServiceUrl}/api/analyze-screenshot`,
        formData,
        {
          headers: formData.getHeaders()
        }
      );

      const visionResult = response.data;
      const selectors: ElementSelector[] = [];

      // Match vision elements with target description
      for (const element of visionResult.elements || []) {
        if (this.matchesDescription(element, targetDescription)) {
          if (element.position) {
            selectors.push({
              type: 'visual',
              value: `x:${element.position.x},y:${element.position.y}`,
              stability_score: 0.40,
              confidence: 0.7
            });
          }
        }
      }

      return selectors;
    } catch (error) {
      console.error('Vision analysis error:', error);
      return [];
    }
  }

  private matchesDescription(
    element: any,
    description: ElementDescription
  ): boolean {
    // Match by text
    if (description.text && element.text) {
      if (element.text.toLowerCase().includes(description.text.toLowerCase())) {
        return true;
      }
    }

    // Match by type/role
    if (description.role && element.type) {
      if (element.type.toLowerCase() === description.role.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  private combineSelectors(
    domSelectors: ElementSelector[],
    visionSelectors: ElementSelector[],
    targetDescription: ElementDescription
  ): ElementSelector[] {
    const combined = [...domSelectors];

    // Add vision selectors with adjusted scores
    for (const visionSelector of visionSelectors) {
      // Boost vision selector if it matches DOM selector
      const matchingDom = domSelectors.find(ds => 
        ds.value === visionSelector.value || 
        (ds.type === 'text' && visionSelector.type === 'visual')
      );
      
      if (matchingDom) {
        visionSelector.stability_score = Math.max(
          visionSelector.stability_score,
          matchingDom.stability_score * 0.9
        );
      }

      combined.push(visionSelector);
    }

    return combined;
  }

  private deduplicateAndRank(selectors: ElementSelector[]): ElementSelector[] {
    const seen = new Set<string>();
    const unique: ElementSelector[] = [];

    for (const selector of selectors) {
      const key = `${selector.type}:${selector.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(selector);
      }
    }

    // Sort by stability score (highest first)
    return unique.sort((a, b) => b.stability_score - a.stability_score);
  }

  /**
   * Try to locate element using Playwright with selector list
   */
  async locateElementWithSelectors(
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
        return null;

      case 'xpath':
        return page.locator(selector.value);

      case 'visual':
        // Visual selectors need special handling
        // For now, return null - would need coordinate-based clicking
        return null;

      default:
        return null;
    }
  }
}

