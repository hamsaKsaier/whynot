import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';
import {
  IntegrationRepository,
  IntegrationEntity,
  CreateIntegrationInput,
  BugTaskEntity,
} from '../../shared/database/repositories/integration-repository';
import { query } from '../../shared/database/connection';

const logger = createLogger('integration-service');

interface BugDetails {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  reproduction_steps: any;
  expected_behavior: string;
  actual_behavior: string;
  screenshot_url?: string;
  video_path?: string;
  session_id: string;
  website_url?: string;
}

interface CreateTaskResult {
  success: boolean;
  external_id?: string;
  external_url?: string;
  error?: string;
}

export class IntegrationService {
  private repository: IntegrationRepository;

  constructor() {
    this.repository = new IntegrationRepository();
  }

  // ─── Integration CRUD ───

  async createIntegration(input: CreateIntegrationInput): Promise<IntegrationEntity> {
    return this.repository.create(input);
  }

  async getIntegrations(workspaceId: string): Promise<IntegrationEntity[]> {
    return this.repository.findByWorkspace(workspaceId);
  }

  async getIntegration(id: string): Promise<IntegrationEntity | null> {
    return this.repository.findById(id);
  }

  async updateIntegration(id: string, updates: Partial<Pick<IntegrationEntity, 'name' | 'config' | 'is_active'>>): Promise<IntegrationEntity | null> {
    return this.repository.update(id, updates);
  }

  async deleteIntegration(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  // ─── Connection Testing ───

  async testConnection(integration: IntegrationEntity): Promise<{ success: boolean; message: string }> {
    try {
      switch (integration.type) {
        case 'jira':
          return await this.testJiraConnection(integration.config);
        case 'clickup':
          return await this.testClickUpConnection(integration.config);
        case 'linear':
          return await this.testLinearConnection(integration.config);
        default:
          return { success: false, message: `Unknown integration type: ${integration.type}` };
      }
    } catch (error: any) {
      logger.error('Connection test failed', { type: integration.type, error: error.message });
      return { success: false, message: error.message };
    }
  }

  private async testJiraConnection(config: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const { apiUrl, email, apiToken } = config;
    if (!apiUrl || !email || !apiToken) {
      return { success: false, message: 'Missing required Jira config: apiUrl, email, apiToken' };
    }

    const response = await fetch(`${apiUrl}/rest/api/3/myself`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const user: any = await response.json();
      return { success: true, message: `Connected as ${user.displayName || user.emailAddress}` };
    }

    return { success: false, message: `Jira returned ${response.status}: ${response.statusText}` };
  }

  private async testClickUpConnection(config: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const { apiToken } = config;
    if (!apiToken) {
      return { success: false, message: 'Missing required ClickUp config: apiToken' };
    }

    const response = await fetch('https://api.clickup.com/api/v2/user', {
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data: any = await response.json();
      return { success: true, message: `Connected as ${data.user?.username || 'ClickUp User'}` };
    }

    return { success: false, message: `ClickUp returned ${response.status}: ${response.statusText}` };
  }

  private async testLinearConnection(config: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const { apiKey } = config;
    if (!apiKey) {
      return { success: false, message: 'Missing required Linear config: apiKey' };
    }

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ viewer { id name email } }' }),
    });

    if (response.ok) {
      const data: any = await response.json();
      const viewer = data?.data?.viewer;
      return { success: true, message: `Connected as ${viewer?.name || viewer?.email || 'Linear User'}` };
    }

    return { success: false, message: `Linear returned ${response.status}: ${response.statusText}` };
  }

  // ─── Create Task from Bug ───

  async createTaskFromBug(
    bugId: string,
    integrationId: string,
    options?: { priority?: string; labels?: string[] }
  ): Promise<BugTaskEntity> {
    // Load bug details
    const bugs = await query<BugDetails>(
      `SELECT b.*, s.target_url as website_url, s.video_path as session_video_path
       FROM qa_loop_bugs b
       JOIN qa_loop_sessions s ON s.id = b.session_id
       WHERE b.id = $1`,
      [bugId]
    );

    if (bugs.length === 0) {
      throw new Error(`Bug not found: ${bugId}`);
    }

    const bug = bugs[0];

    // Load integration
    const integration = await this.repository.findById(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    // Create the task in the external tool
    let result: CreateTaskResult;

    switch (integration.type) {
      case 'jira':
        result = await this.createJiraTask(integration.config, bug, options);
        break;
      case 'clickup':
        result = await this.createClickUpTask(integration.config, bug, options);
        break;
      case 'linear':
        result = await this.createLinearTask(integration.config, bug, options);
        break;
      default:
        throw new Error(`Unsupported integration type: ${integration.type}`);
    }

    if (!result.success) {
      throw new Error(`Failed to create task: ${result.error}`);
    }

    // Save the link
    return this.repository.createBugTask({
      bug_id: bugId,
      integration_id: integrationId,
      external_id: result.external_id!,
      external_url: result.external_url,
    });
  }

  private buildTaskDescription(bug: BugDetails): string {
    const lines: string[] = [];

    lines.push(`**Severity:** ${bug.severity || 'medium'}`);
    lines.push(`**Category:** ${bug.category || 'functional'}`);
    lines.push(`**URL:** ${bug.website_url || 'N/A'}`);
    lines.push('');

    if (bug.description) {
      lines.push(`## Description`);
      lines.push(bug.description);
      lines.push('');
    }

    if (bug.expected_behavior) {
      lines.push(`## Expected Behavior`);
      lines.push(bug.expected_behavior);
      lines.push('');
    }

    if (bug.actual_behavior) {
      lines.push(`## Actual Behavior`);
      lines.push(bug.actual_behavior);
      lines.push('');
    }

    if (bug.reproduction_steps) {
      lines.push(`## Reproduction Steps`);
      const steps = typeof bug.reproduction_steps === 'string'
        ? JSON.parse(bug.reproduction_steps)
        : bug.reproduction_steps;

      if (Array.isArray(steps)) {
        steps.forEach((step: any, i: number) => {
          if (typeof step === 'string') {
            lines.push(`${i + 1}. ${step}`);
          } else {
            lines.push(`${i + 1}. ${step.action || step.description || JSON.stringify(step)}`);
          }
        });
      }
      lines.push('');
    }

    // Include video recording link if available
    const videoPath = (bug as any).video_path || (bug as any).session_video_path;
    if (videoPath) {
      const baseUrl = env.FRONTEND_URL || env.GATEWAY_URL;
      lines.push('');
      lines.push(`## Video Recording`);
      lines.push(`[Watch session recording](${baseUrl}/api/videos/${videoPath})`);
    }

    lines.push('');
    lines.push('---');
    lines.push('*Generated by WhyNot QA - Autonomous Testing Platform*');

    return lines.join('\n');
  }

  private mapSeverityToJiraPriority(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'Highest';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Medium';
    }
  }

  private mapSeverityToClickUpPriority(severity: string): number {
    switch (severity?.toLowerCase()) {
      case 'critical': return 1; // Urgent
      case 'high': return 2; // High
      case 'medium': return 3; // Normal
      case 'low': return 4; // Low
      default: return 3;
    }
  }

  private async createJiraTask(
    config: Record<string, any>,
    bug: BugDetails,
    options?: { priority?: string; labels?: string[] }
  ): Promise<CreateTaskResult> {
    const { apiUrl, email, apiToken, projectKey } = config;

    const description = this.buildTaskDescription(bug);

    // Convert markdown to Jira ADF (Atlassian Document Format)
    const adfBody = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }
      ]
    };

    const issueData: any = {
      fields: {
        project: { key: projectKey },
        summary: `[Bug] ${bug.title}`,
        description: adfBody,
        issuetype: { name: 'Bug' },
        priority: { name: this.mapSeverityToJiraPriority(bug.severity) },
      }
    };

    if (options?.labels && options.labels.length > 0) {
      issueData.fields.labels = options.labels;
    }

    try {
      const response = await fetch(`${apiUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(issueData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Jira API error ${response.status}: ${errorText}` };
      }

      const result: any = await response.json();
      return {
        success: true,
        external_id: result.key, // e.g. PROJ-123
        external_url: `${apiUrl}/browse/${result.key}`,
      };
    } catch (error: any) {
      return { success: false, error: `Jira request failed: ${error.message}` };
    }
  }

  private async createClickUpTask(
    config: Record<string, any>,
    bug: BugDetails,
    options?: { priority?: string; labels?: string[] }
  ): Promise<CreateTaskResult> {
    const { apiToken } = config;
    let { listId } = config;

    // Extract numeric list ID if user pasted a full ClickUp URL
    // e.g. "https://app.clickup.com/90121527112/v/li/901201568604" → "901201568604"
    if (listId && listId.includes('clickup.com')) {
      const match = listId.match(/\/li\/(\d+)/);
      if (match) {
        listId = match[1];
      }
    }

    if (!listId || !apiToken) {
      return { success: false, error: 'Missing ClickUp API token or List ID' };
    }

    const description = this.buildTaskDescription(bug);

    const taskData: any = {
      name: `[Bug] ${bug.title}`,
      description,
      priority: this.mapSeverityToClickUpPriority(bug.severity),
      tags: options?.labels || ['bug', 'automated-qa'],
    };

    try {
      const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
        method: 'POST',
        headers: {
          'Authorization': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `ClickUp API error ${response.status}: ${errorText}` };
      }

      const result: any = await response.json();
      return {
        success: true,
        external_id: result.id,
        external_url: result.url,
      };
    } catch (error: any) {
      return { success: false, error: `ClickUp request failed: ${error.message}` };
    }
  }

  private async createLinearTask(
    config: Record<string, any>,
    bug: BugDetails,
    options?: { priority?: string; labels?: string[] }
  ): Promise<CreateTaskResult> {
    const { apiKey, teamId } = config;

    const description = this.buildTaskDescription(bug);

    // Map severity to Linear priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)
    const priorityMap: Record<string, number> = {
      critical: 1, high: 2, medium: 3, low: 4
    };
    const priority = priorityMap[bug.severity?.toLowerCase()] || 3;

    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `;

    try {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            input: {
              teamId,
              title: `[Bug] ${bug.title}`,
              description,
              priority,
            }
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Linear API error ${response.status}: ${errorText}` };
      }

      const result: any = await response.json();
      const issue = result?.data?.issueCreate?.issue;

      if (!issue) {
        return { success: false, error: `Linear returned unexpected response: ${JSON.stringify(result)}` };
      }

      return {
        success: true,
        external_id: issue.identifier,
        external_url: issue.url,
      };
    } catch (error: any) {
      return { success: false, error: `Linear request failed: ${error.message}` };
    }
  }

  // ─── Bug Tasks ───

  async getBugTasks(bugId: string): Promise<BugTaskEntity[]> {
    return this.repository.findBugTasks(bugId);
  }
}
