import * as cheerio from 'cheerio';
import { ElementSelector } from '../../domain/models';

export interface DOMElement {
  tag: string;
  attributes: Record<string, string>;
  text: string;
  xpath?: string;
}

export class DOMAnalyzer {
  /**
   * Analyze HTML and extract potential selectors for elements
   */
  analyzeHTML(html: string, targetDescription: any): ElementSelector[] {
    const $ = cheerio.load(html);
    const selectors: ElementSelector[] = [];

    // Find elements matching the description
    const candidates = this.findMatchingElements($, targetDescription);

    for (const element of candidates) {
      const elementSelectors = this.extractSelectors($, element);
      selectors.push(...elementSelectors);
    }

    // Sort by stability score (highest first)
    return selectors.sort((a, b) => b.stability_score - a.stability_score);
  }

  private findMatchingElements($: cheerio.CheerioAPI, description: any): cheerio.Cheerio<any>[] {
    const candidates: cheerio.Cheerio<any>[] = [];

    // Search by text content
    if (description.text) {
      $(`*:contains("${description.text}")`).each((_, el) => {
        const $el = $(el);
        if ($el.text().trim().includes(description.text)) {
          candidates.push($el);
        }
      });
    }

    // Search by role
    if (description.role) {
      $(`[role="${description.role}"]`).each((_, el) => {
        candidates.push($(el));
      });
    }

    // Search by placeholder
    if (description.placeholder) {
      $(`[placeholder*="${description.placeholder}"]`).each((_, el) => {
        candidates.push($(el));
      });
    }

    // Search by label/aria-label
    if (description.label) {
      $(`[aria-label*="${description.label}"], label:contains("${description.label}")`).each((_, el) => {
        candidates.push($(el));
      });
    }

    // Search by tag type based on role
    if (description.role === 'button') {
      $('button').each((_, el) => {
        candidates.push($(el));
      });
    } else if (description.role === 'textbox' || description.role === 'input') {
      $('input, textarea').each((_, el) => {
        candidates.push($(el));
      });
    } else if (description.role === 'link' || description.role === 'navigation') {
      $('a').each((_, el) => {
        candidates.push($(el));
      });
    }

    // Search for links if description mentions "link" or "links"
    const descriptionText = JSON.stringify(description).toLowerCase();
    if (descriptionText.includes('link') && !descriptionText.includes('button')) {
      $('a').each((_, el) => {
        const $el = $(el);
        // Only add if it matches other criteria or if we're just looking for any links
        if (!description.text || $el.text().toLowerCase().includes(description.text.toLowerCase())) {
          candidates.push($el);
        }
      });
    }

    return candidates;
  }

  private extractSelectors($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): ElementSelector[] {
    const selectors: ElementSelector[] = [];

    // 1. Data attributes (highest stability)
    const dataTestId = element.attr('data-testid') || element.attr('data-cy');
    if (dataTestId) {
      selectors.push({
        type: 'data-testid',
        value: `[data-testid="${dataTestId}"]`,
        stability_score: 0.95
      });
    }

    // 2. Stable ID
    const id = element.attr('id');
    if (id && this.isStableId(id)) {
      selectors.push({
        type: 'id',
        value: `#${id}`,
        stability_score: 0.85
      });
    }

    // 3. Aria-label
    const ariaLabel = element.attr('aria-label');
    if (ariaLabel) {
      selectors.push({
        type: 'aria-label',
        value: `[aria-label="${ariaLabel}"]`,
        stability_score: 0.75
      });
    }

    // 4. Role attribute
    const role = element.attr('role');
    if (role) {
      selectors.push({
        type: 'css',
        value: `[role="${role}"]`,
        stability_score: 0.70
      });
    }

    // 5. Text content (if unique)
    const text = element.text().trim();
    if (text && text.length < 100) {
      // Check if text is unique on page
      const textCount = $(`*:contains("${text}")`).length;
      if (textCount <= 3) {
        selectors.push({
          type: 'text',
          value: `text="${text}"`,
          stability_score: 0.60
        });
      }
    }

    // 6. Class names (process all classes, rank by stability)
    const className = element.attr('class');
    if (className) {
      const classes = className.split(' ').filter(c => c && c.trim().length > 0);
      
      // Separate stable and unstable classes
      const stableClasses: string[] = [];
      const unstableClasses: string[] = [];
      
      for (const cls of classes) {
        const trimmedClass = cls.trim();
        // Skip state classes
        if (trimmedClass.includes('hover') || trimmedClass.includes('active') || 
            trimmedClass.includes('focus') || trimmedClass.includes('disabled')) {
          continue;
        }
        
        if (this.isStableClass(trimmedClass)) {
          stableClasses.push(trimmedClass);
        } else {
          unstableClasses.push(trimmedClass);
        }
      }
      
      // Add stable classes with higher score (0.65)
      for (const cls of stableClasses) {
        selectors.push({
          type: 'class',
          value: `.${cls}`,
          stability_score: 0.65
        });
      }
      
      // Add unstable classes with lower score (0.40)
      for (const cls of unstableClasses) {
        selectors.push({
          type: 'class',
          value: `.${cls}`,
          stability_score: 0.40
        });
      }
    }

    // 7. Tag-based selector (for links, buttons, etc.)
    const tagName = element.prop('tagName')?.toLowerCase();
    if (tagName === 'a') {
      // For links, add a generic 'a' selector as fallback
      selectors.push({
        type: 'css',
        value: 'a',
        stability_score: 0.35
      });
      // Also add selector with href if available
      const href = element.attr('href');
      if (href) {
        selectors.push({
          type: 'css',
          value: `a[href="${href}"]`,
          stability_score: 0.80
        });
      }
    }

    // 8. XPath (last resort)
    const xpath = this.generateXPath($, element);
    if (xpath) {
      selectors.push({
        type: 'xpath',
        value: xpath,
        stability_score: 0.30
      });
    }

    return selectors;
  }

  private isStableId(id: string): boolean {
    // Check if ID looks stable (not auto-generated)
    const unstablePatterns = [
      /^[0-9]+$/,  // Pure numbers
      /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/i,  // UUIDs
      /^react-/,   // React auto-generated
      /^ember/,    // Ember auto-generated
    ];

    return !unstablePatterns.some(pattern => pattern.test(id));
  }

  /**
   * Check if a CSS class name is stable (semantic) or unstable (framework-generated)
   * @param className The class name to check
   * @returns true if stable, false if unstable
   */
  private isStableClass(className: string): boolean {
    // Filter out empty strings and whitespace
    if (!className || className.trim().length === 0) {
      return false;
    }

    const trimmedClass = className.trim();

    // Reject state classes
    const stateClasses = ['hover', 'active', 'focus', 'disabled', 'selected', 'checked', 'open', 'closed'];
    if (stateClasses.includes(trimmedClass.toLowerCase())) {
      return false;
    }

    // Reject unstable patterns (framework-generated)
    const unstablePatterns = [
      /^[a-z0-9]{6,}$/i,  // Random hash-like: sc-123abc, abc123def
      /^css-[a-z0-9]+$/i,  // CSS-in-JS: css-xyz789
      /^[a-z]+-\d+$/i,     // Index-based: item-0, button-1, card-2
      /^(mt|mb|ml|mr|pt|pb|pl|pr|px|py|mx|my|w-|h-|bg-|text-|border-|rounded-|shadow-|flex|grid)-\d+$/i,  // Tailwind utilities with numbers
    ];

    if (unstablePatterns.some(pattern => pattern.test(trimmedClass))) {
      return false;
    }

    // Accept stable patterns (semantic classes)
    const stablePatterns = [
      /^[a-z]+(-[a-z]+)+$/i,  // BEM: button-primary, card-header, login-form
      /^[a-z]+__[a-z]+/i,     // BEM element: button__text, card__header
      /^(login|submit|cancel|save|delete|edit|add|remove|search|filter|menu|nav|header|footer|sidebar|content|main|container|wrapper|form|input|button|link|card|modal|dialog|dropdown|tab|panel|sidebar|navbar|breadcrumb|pagination|alert|notification|badge|tooltip|popover|accordion|carousel|slider|tabs|accordion)/i,  // Semantic names
    ];

    return stablePatterns.some(pattern => pattern.test(trimmedClass));
  }

  private generateXPath($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): string | null {
    // Simple XPath generation
    const tag = element.prop('tagName')?.toLowerCase();
    if (!tag) return null;

    const index = element.index() + 1;
    return `//${tag}[${index}]`;
  }

  /**
   * Get all elements from HTML with their potential selectors
   */
  getAllElements(html: string): DOMElement[] {
    const $ = cheerio.load(html);
    const elements: DOMElement[] = [];

    $('*').each((_, el) => {
      const $el = $(el);
      const tag = $el.prop('tagName')?.toLowerCase();
      if (!tag || tag === 'html' || tag === 'head' || tag === 'body') return;

      const attributes: Record<string, string> = {};
      if ('attribs' in el && el.attribs) {
        Object.keys(el.attribs).forEach(key => {
          attributes[key] = el.attribs![key];
        });
      }

      elements.push({
        tag,
        attributes,
        text: $el.text().trim()
      });
    });

    return elements;
  }
}

