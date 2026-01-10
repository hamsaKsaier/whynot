import { TestCase } from '../domain/models';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('flow-detector');

export type FlowType = 'login' | 'crud' | 'complex';

/**
 * Detects the type of flow based on test case name and step descriptions
 */
export class FlowDetector {
  private loginKeywords = [
    'login', 'sign in', 'signin', 'log in', 'authenticate', 'authentication',
    'email', 'password', 'username', 'credentials', 'account'
  ];

  private crudKeywords = [
    'create', 'add', 'new', 'insert',
    'read', 'view', 'get', 'fetch', 'retrieve',
    'update', 'edit', 'modify', 'change',
    'delete', 'remove', 'destroy', 'erase',
    'save', 'submit', 'post', 'put', 'patch'
  ];

  /**
   * Detect flow type from test case
   */
  detectFlowType(testCase: TestCase): FlowType {
    const text = `${testCase.name} ${testCase.description} ${testCase.steps.map(s => s.description).join(' ')}`.toLowerCase();

    // Check for login keywords
    const hasLoginKeywords = this.loginKeywords.some(keyword => text.includes(keyword));
    
    // Check for CRUD keywords
    const hasCrudKeywords = this.crudKeywords.some(keyword => text.includes(keyword));

    if (hasLoginKeywords) {
      logger.debug('Detected login flow', { testCaseId: testCase.id, testCaseName: testCase.name });
      return 'login';
    }

    if (hasCrudKeywords) {
      logger.debug('Detected CRUD flow', { testCaseId: testCase.id, testCaseName: testCase.name });
      return 'crud';
    }

    logger.debug('Detected complex flow', { testCaseId: testCase.id, testCaseName: testCase.name });
    return 'complex';
  }

  /**
   * Check if a flow is basic (login or crud)
   */
  isBasicFlow(testCase: TestCase): boolean {
    const flowType = this.detectFlowType(testCase);
    return flowType === 'login' || flowType === 'crud';
  }
}





