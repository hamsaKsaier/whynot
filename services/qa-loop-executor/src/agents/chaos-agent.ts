import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository, QALoopPage } from '../repositories/qa-loop-repository';
import { emitToSession } from '../api/websocket';
import axios from 'axios';

const logger = createLogger('chaos-agent');

// Attack pattern types
export interface AttackPattern {
  id: string;
  category: string;
  name: string;
  description?: string;
  payloads: string[];
  appliesTo: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ChaosResult {
  patternId?: string;
  pageUrl: string;
  elementSelector?: string;
  elementType?: string;
  attackCategory: string;
  attackName: string;
  payloadUsed: string;
  result: 'vulnerable' | 'blocked' | 'error' | 'timeout' | 'inconclusive';
  vulnerabilityConfirmed: boolean;
  evidenceScreenshot?: string;
  consoleOutput?: string;
  networkResponse?: any;
  domChanges?: any;
  errorMessage?: string;
  severity?: string;
  confidence: number;
  reproductionSteps: string[];
}

export interface AttackPlan {
  targets: AttackTarget[];
  estimatedAttacks: number;
  priorityOrder: string[];
}

export interface AttackTarget {
  pageUrl: string;
  elements: PageElement[];
  suggestedAttacks: string[];
  riskLevel: string;
}

export interface PageElement {
  selector: string;
  type: string;
  name?: string;
  attributes?: Record<string, string>;
}

export interface ChaosSummary {
  totalAttacks: number;
  vulnerabilitiesFound: number;
  blockedAttacks: number;
  errors: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  pagesTested: number;
  inputsTested: number;
  durationMs: number;
}

// Default attack patterns
const DEFAULT_ATTACK_PATTERNS: AttackPattern[] = [
  // SQL Injection
  {
    id: 'sql_injection_basic',
    category: 'injection',
    name: 'SQL Injection Basic',
    payloads: ["' OR '1'='1", "1' OR '1'='1", "' OR 1=1--", "admin'--", "'; DROP TABLE users;--"],
    appliesTo: 'text_input',
    severity: 'critical'
  },
  // XSS
  {
    id: 'xss_script',
    category: 'xss',
    name: 'XSS Script Tags',
    payloads: ["<script>alert('xss')</script>", "<img src=x onerror=alert(1)>", "<svg onload=alert(1)>"],
    appliesTo: 'text_input',
    severity: 'critical'
  },
  {
    id: 'xss_event',
    category: 'xss',
    name: 'XSS Event Handlers',
    payloads: ["<img onerror=alert(1) src=x>", "<div onmouseover=alert(1)>test</div>"],
    appliesTo: 'text_input',
    severity: 'high'
  },
  // Boundary
  {
    id: 'boundary_empty',
    category: 'boundary',
    name: 'Empty Values',
    payloads: ['', ' ', '  ', '\t', '\n'],
    appliesTo: 'text_input',
    severity: 'medium'
  },
  {
    id: 'boundary_length',
    category: 'boundary',
    name: 'Extreme Lengths',
    payloads: ['a', 'a'.repeat(1000), 'a'.repeat(10000)],
    appliesTo: 'text_input',
    severity: 'medium'
  },
  {
    id: 'boundary_special',
    category: 'boundary',
    name: 'Special Characters',
    payloads: ['!@#$%^&*()', '<>{}[]|\\', '"\'`~', 'null', 'undefined', 'NaN'],
    appliesTo: 'text_input',
    severity: 'medium'
  },
  {
    id: 'boundary_numeric',
    category: 'boundary',
    name: 'Numeric Edge Cases',
    payloads: ['0', '-1', '-999999999', '999999999', '2147483647', '-2147483648', 'NaN', 'Infinity'],
    appliesTo: 'text_input',
    severity: 'medium'
  },
  {
    id: 'boundary_unicode',
    category: 'boundary',
    name: 'Unicode Special',
    payloads: ['🔥💀🎉', '你好', 'مرحبا', '\u0000', '\uFFFF'],
    appliesTo: 'text_input',
    severity: 'low'
  },
  // Command Injection
  {
    id: 'cmd_injection',
    category: 'injection',
    name: 'Command Injection',
    payloads: ['; ls -la', '| cat /etc/passwd', '$(whoami)', '`id`'],
    appliesTo: 'text_input',
    severity: 'critical'
  },
  // Path Traversal
  {
    id: 'path_traversal',
    category: 'injection',
    name: 'Path Traversal',
    payloads: ['../../../etc/passwd', '..\\..\\..\\windows\\win.ini', '....//....//etc/passwd'],
    appliesTo: 'text_input',
    severity: 'high'
  }
];

export class ChaosAgent {
  private sessionId: string;
  private repository: QALoopRepository;
  private testExecutorUrl: string;
  private attackPatterns: AttackPattern[];
  private results: ChaosResult[] = [];
  private startTime: number = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.testExecutorUrl = process.env.TEST_EXECUTOR_URL || 'http://localhost:3001';
    this.attackPatterns = DEFAULT_ATTACK_PATTERNS;
  }

  /**
   * Plan chaos attacks for discovered pages
   */
  async planAttacks(pages: QALoopPage[]): Promise<AttackPlan> {
    logger.info('Planning chaos attacks', { sessionId: this.sessionId, pageCount: pages.length });

    const targets: AttackTarget[] = [];
    let estimatedAttacks = 0;

    for (const page of pages) {
      // Prioritize pages with forms, inputs, or auth-related features
      const elements = page.discovered_elements || {};
      const inputs = elements.inputs || [];
      const forms = elements.forms || [];

      if (inputs.length === 0 && forms.length === 0) {
        continue;
      }

      const pageElements: PageElement[] = [
        ...inputs.map((i: any) => ({
          selector: i.selector || `input[name="${i.name}"]`,
          type: i.type || 'text',
          name: i.name,
          attributes: i
        })),
        ...forms.flatMap((f: any) => (f.fields || []).map((field: any) => ({
          selector: field.selector || `input[name="${field.name}"]`,
          type: field.type || 'text',
          name: field.name,
          attributes: field
        })))
      ];

      // Determine which attacks apply
      const suggestedAttacks = this.getSuggestedAttacks(pageElements, page);
      estimatedAttacks += pageElements.length * suggestedAttacks.length * 3; // Avg 3 payloads per attack

      targets.push({
        pageUrl: page.url,
        elements: pageElements,
        suggestedAttacks,
        riskLevel: this.calculateRiskLevel(page, pageElements)
      });
    }

    // Sort by risk level
    targets.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (riskOrder[a.riskLevel as keyof typeof riskOrder] || 3) -
        (riskOrder[b.riskLevel as keyof typeof riskOrder] || 3);
    });

    return {
      targets,
      estimatedAttacks,
      priorityOrder: targets.map(t => t.pageUrl)
    };
  }

  /**
   * Run chaos testing on a specific page
   */
  async runChaos(page: QALoopPage): Promise<ChaosResult[]> {
    logger.info('Running chaos tests', { sessionId: this.sessionId, pageUrl: page.url });
    this.startTime = Date.now();
    const results: ChaosResult[] = [];

    const elements = page.discovered_elements || {};
    const inputs = elements.inputs || [];
    const forms = elements.forms || [];

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'chaos',
        pageUrl: page.url,
        message: `Starting chaos testing on ${page.url}`
      }
    });

    // Test each input field
    for (const input of inputs) {
      const inputResults = await this.testElement(page.url, input);
      results.push(...inputResults);
    }

    // Test form fields
    for (const form of forms) {
      for (const field of (form.fields || [])) {
        const fieldResults = await this.testElement(page.url, field, form);
        results.push(...fieldResults);
      }
    }

    // Save results to database
    await this.saveResults(results);

    this.results = [...this.results, ...results];
    return results;
  }

  /**
   * Test a single element with various attack patterns
   */
  private async testElement(
    pageUrl: string,
    element: any,
    form?: any
  ): Promise<ChaosResult[]> {
    const results: ChaosResult[] = [];
    const selector = element.selector || `input[name="${element.name}"]`;
    const elementType = element.type || 'text';

    // Get applicable attacks for this element type
    const applicablePatterns = this.attackPatterns.filter(p =>
      p.appliesTo === 'text_input' || p.appliesTo === elementType || p.appliesTo === 'any'
    );

    for (const pattern of applicablePatterns) {
      // Test a subset of payloads (first 3) for efficiency
      const payloadsToTest = pattern.payloads.slice(0, 3);

      for (const payload of payloadsToTest) {
        try {
          const result = await this.executeAttack(pageUrl, selector, payload, pattern, form);
          results.push(result);

          // Emit finding if vulnerable
          if (result.result === 'vulnerable') {
            emitToSession(this.sessionId, {
              type: 'bug_found',
              data: {
                title: `${pattern.name} Vulnerability`,
                severity: pattern.severity,
                category: 'security',
                pageUrl
              }
            });
          }

          // Brief delay between attacks
          await this.sleep(100);

        } catch (error: any) {
          logger.warn('Attack execution failed', {
            pattern: pattern.name,
            error: error.message
          });

          results.push({
            pageUrl,
            elementSelector: selector,
            elementType,
            attackCategory: pattern.category,
            attackName: pattern.name,
            payloadUsed: payload,
            result: 'error',
            vulnerabilityConfirmed: false,
            errorMessage: error.message,
            confidence: 0,
            reproductionSteps: []
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single attack payload
   */
  private async executeAttack(
    pageUrl: string,
    selector: string,
    payload: string,
    pattern: AttackPattern,
    form?: any
  ): Promise<ChaosResult> {
    try {
      // Navigate to page
      await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
        url: pageUrl,
        timeout: 30000
      }, { timeout: 45000 });

      // Clear and type payload
      await axios.post(`${this.testExecutorUrl}/api/action`, {
        action: 'type',
        selector,
        value: payload,
        clearFirst: true,
        timeout: 10000
      }, { timeout: 30000 });

      // If there's a form, submit it
      if (form?.action || form?.selector) {
        try {
          await axios.post(`${this.testExecutorUrl}/api/action`, {
            action: 'click',
            selector: form.submitSelector || 'button[type="submit"]',
            timeout: 5000
          }, { timeout: 15000 });

          // Wait for response
          await this.sleep(1000);
        } catch (submitError) {
          // Form submission might fail, continue
        }
      }

      // Capture result state
      const stateResponse = await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
        captureCurrentPage: true,
        includeScreenshot: true
      }, { timeout: 30000 });

      // Analyze result
      const analysis = this.analyzeAttackResult(
        payload,
        pattern,
        stateResponse.data
      );

      return {
        pageUrl,
        elementSelector: selector,
        elementType: 'text_input',
        attackCategory: pattern.category,
        attackName: pattern.name,
        payloadUsed: payload,
        result: analysis.result,
        vulnerabilityConfirmed: analysis.confirmed,
        evidenceScreenshot: stateResponse.data.screenshot,
        consoleOutput: analysis.consoleOutput,
        networkResponse: analysis.networkResponse,
        domChanges: analysis.domChanges,
        severity: analysis.confirmed ? pattern.severity : undefined,
        confidence: analysis.confidence,
        reproductionSteps: [
          `Navigate to ${pageUrl}`,
          `Enter "${payload}" into ${selector}`,
          form ? 'Submit the form' : 'Observe the response'
        ]
      };

    } catch (error: any) {
      return {
        pageUrl,
        elementSelector: selector,
        elementType: 'text_input',
        attackCategory: pattern.category,
        attackName: pattern.name,
        payloadUsed: payload,
        result: 'error',
        vulnerabilityConfirmed: false,
        errorMessage: error.message,
        confidence: 0,
        reproductionSteps: []
      };
    }
  }

  /**
   * Analyze attack result to determine if vulnerable
   */
  private analyzeAttackResult(
    payload: string,
    pattern: AttackPattern,
    pageState: any
  ): {
    result: 'vulnerable' | 'blocked' | 'error' | 'inconclusive';
    confirmed: boolean;
    confidence: number;
    consoleOutput?: string;
    networkResponse?: any;
    domChanges?: any;
  } {
    const html = pageState.html || '';
    const url = pageState.url || '';

    // Check for XSS reflection
    if (pattern.category === 'xss') {
      // Check if payload appears unescaped in HTML
      if (html.includes(payload) && !html.includes(this.escapeHtml(payload))) {
        return {
          result: 'vulnerable',
          confirmed: true,
          confidence: 0.9,
          domChanges: { payloadReflected: true }
        };
      }
    }

    // Check for SQL injection indicators
    if (pattern.category === 'injection' && pattern.name.includes('SQL')) {
      const sqlErrorPatterns = [
        'SQL syntax',
        'mysql_',
        'ORA-',
        'PostgreSQL',
        'sqlite3',
        'SQLSTATE',
        'Unclosed quotation mark'
      ];

      for (const errorPattern of sqlErrorPatterns) {
        if (html.toLowerCase().includes(errorPattern.toLowerCase())) {
          return {
            result: 'vulnerable',
            confirmed: true,
            confidence: 0.85,
            consoleOutput: `SQL error pattern found: ${errorPattern}`
          };
        }
      }
    }

    // Check for path traversal
    if (pattern.name.includes('Path Traversal')) {
      if (html.includes('root:') || html.includes('[boot loader]')) {
        return {
          result: 'vulnerable',
          confirmed: true,
          confidence: 0.95,
          domChanges: { fileContentExposed: true }
        };
      }
    }

    // Check for command injection
    if (pattern.name.includes('Command')) {
      if (html.includes('uid=') || html.includes('total ') || html.includes('drwx')) {
        return {
          result: 'vulnerable',
          confirmed: true,
          confidence: 0.9,
          consoleOutput: 'Command output detected in response'
        };
      }
    }

    // Check for generic error indicators that might reveal issues
    const errorIndicators = ['error', 'exception', 'stack trace', 'fatal'];
    for (const indicator of errorIndicators) {
      if (html.toLowerCase().includes(indicator) && !pageState.originalHtml?.toLowerCase().includes(indicator)) {
        return {
          result: 'inconclusive',
          confirmed: false,
          confidence: 0.5,
          consoleOutput: `Error indicator found: ${indicator}`
        };
      }
    }

    // No vulnerability detected
    return {
      result: 'blocked',
      confirmed: false,
      confidence: 0.7
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getSuggestedAttacks(elements: PageElement[], page: QALoopPage): string[] {
    const attacks: Set<string> = new Set();
    const pageUrl = page.url.toLowerCase();
    const pageType = page.page_type || '';

    // Always test boundary conditions
    attacks.add('boundary');

    // Check for auth-related pages
    if (pageUrl.includes('login') || pageUrl.includes('auth') || pageType === 'login') {
      attacks.add('injection');
      attacks.add('xss');
    }

    // Check for forms with sensitive inputs
    for (const element of elements) {
      const type = element.type?.toLowerCase() || '';
      const name = element.name?.toLowerCase() || '';

      if (type === 'password' || name.includes('password')) {
        attacks.add('injection');
      }

      if (type === 'email' || name.includes('email') || name.includes('search')) {
        attacks.add('xss');
        attacks.add('injection');
      }

      if (name.includes('file') || name.includes('path') || name.includes('url')) {
        attacks.add('injection');
      }
    }

    return Array.from(attacks);
  }

  private calculateRiskLevel(page: QALoopPage, elements: PageElement[]): string {
    const pageUrl = page.url.toLowerCase();
    const pageType = page.page_type || '';

    // Critical: auth, payment, admin
    if (pageUrl.includes('login') || pageUrl.includes('admin') ||
      pageUrl.includes('payment') || pageUrl.includes('checkout')) {
      return 'critical';
    }

    // High: forms with many inputs, user data
    if (pageUrl.includes('profile') || pageUrl.includes('settings') ||
      pageUrl.includes('account') || elements.length > 5) {
      return 'high';
    }

    // Medium: forms with some inputs
    if (elements.length > 2 || pageType === 'form') {
      return 'medium';
    }

    return 'low';
  }

  private async saveResults(results: ChaosResult[]): Promise<void> {
    // This would save to the chaos_results table
    // For now, we'll add bugs for confirmed vulnerabilities
    for (const result of results) {
      if (result.vulnerabilityConfirmed && result.severity) {
        await this.repository.addBug(this.sessionId, {
          title: `${result.attackName}: ${result.attackCategory} vulnerability`,
          description: `Found ${result.attackCategory} vulnerability on ${result.pageUrl} using payload: ${result.payloadUsed}`,
          severity: result.severity as any,
          category: 'security',
          bugType: result.attackCategory,
          pageUrl: result.pageUrl,
          reproductionSteps: result.reproductionSteps
        });
      }
    }
  }

  /**
   * Get summary of chaos testing results
   */
  getSummary(): ChaosSummary {
    const vulnerabilities = this.results.filter(r => r.vulnerabilityConfirmed);

    return {
      totalAttacks: this.results.length,
      vulnerabilitiesFound: vulnerabilities.length,
      blockedAttacks: this.results.filter(r => r.result === 'blocked').length,
      errors: this.results.filter(r => r.result === 'error').length,
      criticalFindings: vulnerabilities.filter(r => r.severity === 'critical').length,
      highFindings: vulnerabilities.filter(r => r.severity === 'high').length,
      mediumFindings: vulnerabilities.filter(r => r.severity === 'medium').length,
      lowFindings: vulnerabilities.filter(r => r.severity === 'low').length,
      pagesTested: new Set(this.results.map(r => r.pageUrl)).size,
      inputsTested: new Set(this.results.map(r => r.elementSelector)).size,
      durationMs: Date.now() - this.startTime
    };
  }

  /**
   * Run accessibility audit on a page
   */
  async runAccessibilityAudit(pageUrl: string): Promise<ChaosResult[]> {
    logger.info('Running accessibility audit', { sessionId: this.sessionId, pageUrl });
    const results: ChaosResult[] = [];

    try {
      // Capture page
      const response = await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
        url: pageUrl,
        includeScreenshot: true
      }, { timeout: 45000 });

      const html = response.data.html || '';

      // Check for missing alt attributes
      const imgWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
      if (imgWithoutAlt > 0) {
        results.push({
          pageUrl,
          attackCategory: 'a11y',
          attackName: 'Missing Alt Text',
          payloadUsed: 'N/A',
          result: 'vulnerable',
          vulnerabilityConfirmed: true,
          severity: 'medium',
          confidence: 0.95,
          reproductionSteps: [`Found ${imgWithoutAlt} images without alt attributes`]
        });
      }

      // Check for missing form labels
      const inputsWithoutLabels = (html.match(/<input(?![^>]*aria-label)[^>]*>/gi) || []).length;
      const labelsCount = (html.match(/<label/gi) || []).length;
      if (inputsWithoutLabels > labelsCount) {
        results.push({
          pageUrl,
          attackCategory: 'a11y',
          attackName: 'Missing Form Labels',
          payloadUsed: 'N/A',
          result: 'vulnerable',
          vulnerabilityConfirmed: true,
          severity: 'medium',
          confidence: 0.8,
          reproductionSteps: [`Found inputs without associated labels`]
        });
      }

      // Check for missing heading structure
      const hasH1 = html.includes('<h1');
      if (!hasH1) {
        results.push({
          pageUrl,
          attackCategory: 'a11y',
          attackName: 'Missing H1 Heading',
          payloadUsed: 'N/A',
          result: 'vulnerable',
          vulnerabilityConfirmed: true,
          severity: 'low',
          confidence: 0.9,
          reproductionSteps: ['Page is missing an H1 heading element']
        });
      }

      // Check for missing language attribute
      if (!html.includes('lang=')) {
        results.push({
          pageUrl,
          attackCategory: 'a11y',
          attackName: 'Missing Language Attribute',
          payloadUsed: 'N/A',
          result: 'vulnerable',
          vulnerabilityConfirmed: true,
          severity: 'low',
          confidence: 0.95,
          reproductionSteps: ['HTML element is missing lang attribute']
        });
      }

    } catch (error: any) {
      logger.error('Accessibility audit failed', { pageUrl, error: error.message });
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
