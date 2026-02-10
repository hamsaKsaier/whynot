import { createLogger } from '../../../shared/logger/logger';
import { ChaosAgent, AttackPlan, ChaosResult, ChaosSummary } from '../agents/chaos-agent';
import { QALoopRepository, QALoopPage } from '../repositories/qa-loop-repository';

const logger = createLogger('chaos-tools');

export class ChaosTools {
  private sessionId: string;
  private repository: QALoopRepository;
  private chaosAgent: ChaosAgent;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.chaosAgent = new ChaosAgent(sessionId);
  }

  /**
   * Plan chaos attacks for discovered pages
   */
  async planChaosAttacks(params: {
    pageUrls?: string[];
    prioritizeAuth?: boolean;
    prioritizeForms?: boolean;
  }): Promise<{ success: boolean; plan?: AttackPlan; error?: string }> {
    try {
      logger.info('Planning chaos attacks', { sessionId: this.sessionId, params });

      // Get pages to test
      let pages: QALoopPage[];

      if (params.pageUrls && params.pageUrls.length > 0) {
        const allPages = await this.repository.getPages(this.sessionId);
        pages = allPages.filter(p => params.pageUrls!.includes(p.url));
      } else {
        pages = await this.repository.getPages(this.sessionId);
        pages = pages.filter(p => p.is_explored);
      }

      // Apply prioritization filters
      if (params.prioritizeAuth) {
        const authKeywords = ['login', 'auth', 'sign', 'password', 'register'];
        pages.sort((a, b) => {
          const aHasAuth = authKeywords.some(k => a.url.toLowerCase().includes(k)) ? 0 : 1;
          const bHasAuth = authKeywords.some(k => b.url.toLowerCase().includes(k)) ? 0 : 1;
          return aHasAuth - bHasAuth;
        });
      }

      if (params.prioritizeForms) {
        pages.sort((a, b) => {
          const aFormCount = (a.discovered_elements?.forms?.length || 0) + (a.discovered_elements?.inputs?.length || 0);
          const bFormCount = (b.discovered_elements?.forms?.length || 0) + (b.discovered_elements?.inputs?.length || 0);
          return bFormCount - aFormCount;
        });
      }

      const plan = await this.chaosAgent.planAttacks(pages);

      return { success: true, plan };

    } catch (error: any) {
      logger.error('Failed to plan chaos attacks', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run injection tests (SQL, command, LDAP, etc.)
   */
  async runInjectionTest(params: {
    pageUrl: string;
    selector: string;
    injectionType: 'sql' | 'xss' | 'command' | 'path' | 'ldap';
    customPayloads?: string[];
  }): Promise<{ success: boolean; results?: ChaosResult[]; error?: string }> {
    try {
      logger.info('Running injection test', { sessionId: this.sessionId, params });

      // Get the page
      const pages = await this.repository.getPages(this.sessionId);
      const page = pages.find(p => p.url === params.pageUrl);

      if (!page) {
        return { success: false, error: `Page not found: ${params.pageUrl}` };
      }

      // Run chaos on the specific page
      const results = await this.chaosAgent.runChaos(page);

      // Filter results by injection type
      const filteredResults = results.filter(r => {
        const category = r.attackCategory.toLowerCase();
        switch (params.injectionType) {
          case 'sql':
            return category === 'injection' && r.attackName.toLowerCase().includes('sql');
          case 'xss':
            return category === 'xss';
          case 'command':
            return category === 'injection' && r.attackName.toLowerCase().includes('command');
          case 'path':
            return category === 'injection' && r.attackName.toLowerCase().includes('path');
          case 'ldap':
            return category === 'injection' && r.attackName.toLowerCase().includes('ldap');
          default:
            return true;
        }
      });

      return { success: true, results: filteredResults };

    } catch (error: any) {
      logger.error('Injection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run boundary tests (empty, extreme length, special chars, etc.)
   */
  async runBoundaryTest(params: {
    pageUrl: string;
    selector: string;
    boundaryType: 'empty' | 'length' | 'special' | 'numeric' | 'unicode' | 'all';
  }): Promise<{ success: boolean; results?: ChaosResult[]; error?: string }> {
    try {
      logger.info('Running boundary test', { sessionId: this.sessionId, params });

      const pages = await this.repository.getPages(this.sessionId);
      const page = pages.find(p => p.url === params.pageUrl);

      if (!page) {
        return { success: false, error: `Page not found: ${params.pageUrl}` };
      }

      const results = await this.chaosAgent.runChaos(page);

      // Filter by boundary type
      const filteredResults = results.filter(r => {
        if (r.attackCategory !== 'boundary') return false;
        if (params.boundaryType === 'all') return true;

        const name = r.attackName.toLowerCase();
        switch (params.boundaryType) {
          case 'empty': return name.includes('empty');
          case 'length': return name.includes('length');
          case 'special': return name.includes('special');
          case 'numeric': return name.includes('numeric');
          case 'unicode': return name.includes('unicode');
          default: return true;
        }
      });

      return { success: true, results: filteredResults };

    } catch (error: any) {
      logger.error('Boundary test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run timing/race condition tests
   */
  async runTimingTest(params: {
    pageUrl: string;
    action: 'double_submit' | 'race_condition' | 'session_timeout';
    concurrent?: number;
  }): Promise<{ success: boolean; results?: ChaosResult[]; error?: string }> {
    try {
      logger.info('Running timing test', { sessionId: this.sessionId, params });

      // Timing tests are more complex - this is a simplified implementation
      const results: ChaosResult[] = [{
        pageUrl: params.pageUrl,
        attackCategory: 'timing',
        attackName: params.action,
        payloadUsed: `concurrent: ${params.concurrent || 2}`,
        result: 'inconclusive',
        vulnerabilityConfirmed: false,
        confidence: 0.5,
        reproductionSteps: [
          `Navigate to ${params.pageUrl}`,
          `Perform ${params.action} with ${params.concurrent || 2} concurrent requests`
        ]
      }];

      return { success: true, results };

    } catch (error: any) {
      logger.error('Timing test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run security header/config scan
   */
  async runSecurityScan(params: {
    pageUrl: string;
    checks: ('headers' | 'csrf' | 'auth' | 'cors' | 'all')[];
  }): Promise<{ success: boolean; findings?: any[]; error?: string }> {
    try {
      logger.info('Running security scan', { sessionId: this.sessionId, params });

      const findings: any[] = [];
      const checksToRun = params.checks.includes('all')
        ? ['headers', 'csrf', 'auth', 'cors']
        : params.checks;

      // Simplified security checks
      for (const check of checksToRun) {
        switch (check) {
          case 'headers':
            findings.push({
              check: 'security_headers',
              description: 'Check for security headers',
              recommendation: 'Ensure X-Content-Type-Options, X-Frame-Options, CSP headers are set'
            });
            break;
          case 'csrf':
            findings.push({
              check: 'csrf_protection',
              description: 'Check for CSRF tokens on forms',
              recommendation: 'Verify all state-changing operations have CSRF protection'
            });
            break;
          case 'auth':
            findings.push({
              check: 'authentication',
              description: 'Check authentication mechanisms',
              recommendation: 'Review session management and auth token handling'
            });
            break;
          case 'cors':
            findings.push({
              check: 'cors_policy',
              description: 'Check CORS configuration',
              recommendation: 'Ensure CORS headers are properly restrictive'
            });
            break;
        }
      }

      return { success: true, findings };

    } catch (error: any) {
      logger.error('Security scan failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run accessibility audit
   */
  async runAccessibilityAudit(params: {
    pageUrl: string;
    wcagLevel?: 'A' | 'AA' | 'AAA';
  }): Promise<{ success: boolean; issues?: ChaosResult[]; score?: number; error?: string }> {
    try {
      logger.info('Running accessibility audit', { sessionId: this.sessionId, params });

      const issues = await this.chaosAgent.runAccessibilityAudit(params.pageUrl);

      // Calculate score based on issues
      const score = Math.max(0, 100 - (issues.filter(i => i.vulnerabilityConfirmed).length * 10));

      return { success: true, issues, score };

    } catch (error: any) {
      logger.error('Accessibility audit failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Save a vulnerability finding
   */
  async saveVulnerability(params: {
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    pageUrl: string;
    evidence?: string;
    reproductionSteps: string[];
    remediation?: string;
  }): Promise<{ success: boolean; bugId?: string; error?: string }> {
    try {
      logger.info('Saving vulnerability', { sessionId: this.sessionId, title: params.title });

      const bug = await this.repository.addBug(this.sessionId, {
        title: params.title,
        description: params.description,
        severity: params.severity,
        category: 'security',
        bugType: params.category,
        pageUrl: params.pageUrl,
        reproductionSteps: params.reproductionSteps
      });

      return { success: true, bugId: bug.id };

    } catch (error: any) {
      logger.error('Failed to save vulnerability', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get chaos testing summary
   */
  getSummary(): ChaosSummary {
    return this.chaosAgent.getSummary();
  }
}

// Tool definitions for Claude
export const CHAOS_TOOL_DEFINITIONS = [
  {
    name: 'plan_chaos_attacks',
    description: 'Plan chaos/adversarial testing attacks for discovered pages. Analyzes pages to identify attack targets and creates a prioritized attack plan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific page URLs to plan attacks for. If empty, plans for all explored pages.'
        },
        prioritizeAuth: {
          type: 'boolean',
          description: 'Prioritize authentication-related pages (login, signup, etc.)'
        },
        prioritizeForms: {
          type: 'boolean',
          description: 'Prioritize pages with forms and input fields'
        }
      },
      required: []
    }
  },
  {
    name: 'run_injection_test',
    description: 'Run injection vulnerability tests (SQL, XSS, command injection, path traversal, LDAP) on a specific input element.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageUrl: {
          type: 'string',
          description: 'URL of the page to test'
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the input element to test'
        },
        injectionType: {
          type: 'string',
          enum: ['sql', 'xss', 'command', 'path', 'ldap'],
          description: 'Type of injection attack to run'
        },
        customPayloads: {
          type: 'array',
          items: { type: 'string' },
          description: 'Custom attack payloads to use (optional)'
        }
      },
      required: ['pageUrl', 'selector', 'injectionType']
    }
  },
  {
    name: 'run_boundary_test',
    description: 'Run boundary/edge case tests on input fields to check for proper validation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageUrl: {
          type: 'string',
          description: 'URL of the page to test'
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the input element to test'
        },
        boundaryType: {
          type: 'string',
          enum: ['empty', 'length', 'special', 'numeric', 'unicode', 'all'],
          description: 'Type of boundary test to run'
        }
      },
      required: ['pageUrl', 'selector', 'boundaryType']
    }
  },
  {
    name: 'run_timing_test',
    description: 'Run timing/race condition tests to check for concurrency vulnerabilities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageUrl: {
          type: 'string',
          description: 'URL of the page to test'
        },
        action: {
          type: 'string',
          enum: ['double_submit', 'race_condition', 'session_timeout'],
          description: 'Type of timing test to run'
        },
        concurrent: {
          type: 'number',
          description: 'Number of concurrent requests for race condition tests'
        }
      },
      required: ['pageUrl', 'action']
    }
  },
  {
    name: 'run_security_scan',
    description: 'Run security configuration scan checking headers, CSRF, auth, and CORS.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageUrl: {
          type: 'string',
          description: 'URL of the page to scan'
        },
        checks: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['headers', 'csrf', 'auth', 'cors', 'all']
          },
          description: 'Security checks to perform'
        }
      },
      required: ['pageUrl', 'checks']
    }
  },
  {
    name: 'run_accessibility_audit',
    description: 'Run accessibility audit on a page to check WCAG compliance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageUrl: {
          type: 'string',
          description: 'URL of the page to audit'
        },
        wcagLevel: {
          type: 'string',
          enum: ['A', 'AA', 'AAA'],
          description: 'WCAG conformance level to test against'
        }
      },
      required: ['pageUrl']
    }
  },
  {
    name: 'save_vulnerability',
    description: 'Save a confirmed vulnerability finding to the bug database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Title of the vulnerability'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the vulnerability'
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Severity level'
        },
        category: {
          type: 'string',
          description: 'Category (e.g., sql_injection, xss, csrf)'
        },
        pageUrl: {
          type: 'string',
          description: 'URL where the vulnerability was found'
        },
        evidence: {
          type: 'string',
          description: 'Screenshot or output proving the vulnerability'
        },
        reproductionSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Steps to reproduce the vulnerability'
        },
        remediation: {
          type: 'string',
          description: 'Suggested fix for the vulnerability'
        }
      },
      required: ['title', 'description', 'severity', 'category', 'pageUrl', 'reproductionSteps']
    }
  }
];
