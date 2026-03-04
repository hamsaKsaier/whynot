import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../../shared/database/connection';
import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('notification-service');

export type NotificationChannelType = 'slack' | 'discord' | 'email' | 'webhook';

export interface NotificationChannel {
  id: string;
  name: string;
  channelType: NotificationChannelType;
  config: NotificationConfig;
  isActive: boolean;
  createdAt: Date;
}

export type NotificationConfig = SlackConfig | DiscordConfig | EmailConfig | WebhookConfig;

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface DiscordConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromAddress: string;
  toAddresses: string[];
  useTls?: boolean;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
}

export interface NotificationPayload {
  type: 'session_complete' | 'session_failed' | 'vulnerability_found' | 'budget_exceeded' | 'quality_threshold_reached' | 'custom';
  sessionId?: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
  url?: string;
}

export class NotificationService {
  private pool: Pool;

  // Use the shared singleton pool (4.2); accept an override only for tests
  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  /**
   * Create a new notification channel
   */
  async createChannel(
    name: string,
    channelType: NotificationChannelType,
    config: NotificationConfig
  ): Promise<NotificationChannel> {
    const id = uuidv4();

    const query = `
      INSERT INTO qa_loop_notification_channels (id, name, channel_type, config, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      name,
      channelType,
      JSON.stringify(config)
    ]);

    logger.info('Notification channel created', { id, name, channelType });

    return this.rowToChannel(result.rows[0]);
  }

  /**
   * List all notification channels
   */
  async listChannels(activeOnly: boolean = false): Promise<NotificationChannel[]> {
    let query = 'SELECT * FROM qa_loop_notification_channels';

    if (activeOnly) {
      query += ' WHERE is_active = true';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query);
    return result.rows.map(row => this.rowToChannel(row));
  }

  /**
   * Update a notification channel
   */
  async updateChannel(
    id: string,
    updates: { name?: string; config?: NotificationConfig; isActive?: boolean }
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.name) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.config) {
      setClauses.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(updates.config));
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    if (setClauses.length === 0) return;

    const query = `UPDATE qa_loop_notification_channels SET ${setClauses.join(', ')} WHERE id = $1`;
    await this.pool.query(query, params);

    logger.info('Notification channel updated', { id, updates: Object.keys(updates) });
  }

  /**
   * Delete a notification channel
   */
  async deleteChannel(id: string): Promise<void> {
    await this.pool.query('DELETE FROM qa_loop_notification_channels WHERE id = $1', [id]);
    logger.info('Notification channel deleted', { id });
  }

  /**
   * Send a notification to all active channels
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const channels = await this.listChannels(true);

    logger.info('Sending notifications', {
      type: payload.type,
      channelCount: channels.length
    });

    const results = await Promise.allSettled(
      channels.map(channel => this.sendToChannel(channel, payload))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Notification failed', {
          channel: channels[index].name,
          channelType: channels[index].channelType,
          error: result.reason
        });
      }
    });
  }

  /**
   * Send a notification to a specific channel
   */
  private async sendToChannel(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    switch (channel.channelType) {
      case 'slack':
        await this.sendSlackNotification(channel.config as SlackConfig, payload);
        break;
      case 'discord':
        await this.sendDiscordNotification(channel.config as DiscordConfig, payload);
        break;
      case 'email':
        await this.sendEmailNotification(channel.config as EmailConfig, payload);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel.config as WebhookConfig, payload);
        break;
      default:
        logger.warn('Unknown channel type', { channelType: channel.channelType });
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(config: SlackConfig, payload: NotificationPayload): Promise<void> {
    const color = this.getSeverityColor(payload.severity);

    const slackPayload = {
      username: config.username || 'QA Loop Bot',
      icon_emoji: config.iconEmoji || ':robot_face:',
      channel: config.channel,
      attachments: [{
        color,
        title: payload.title,
        text: payload.message,
        fields: payload.metadata ? Object.entries(payload.metadata).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        })) : [],
        footer: 'QA Loop',
        ts: Math.floor(Date.now() / 1000),
        ...(payload.url && { title_link: payload.url })
      }]
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(config: DiscordConfig, payload: NotificationPayload): Promise<void> {
    const color = this.getDiscordColor(payload.severity);

    const discordPayload = {
      username: config.username || 'QA Loop Bot',
      avatar_url: config.avatarUrl,
      embeds: [{
        title: payload.title,
        description: payload.message,
        color,
        fields: payload.metadata ? Object.entries(payload.metadata).map(([name, value]) => ({
          name,
          value: String(value),
          inline: true
        })) : [],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'QA Loop'
        },
        ...(payload.url && { url: payload.url })
      }]
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      throw new Error(`Discord notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send email notification (placeholder - would need nodemailer or similar)
   */
  private async sendEmailNotification(config: EmailConfig, payload: NotificationPayload): Promise<void> {
    // In production, use nodemailer or a service like SendGrid
    logger.info('Email notification would be sent', {
      to: config.toAddresses,
      subject: payload.title,
      from: config.fromAddress
    });

    // Placeholder implementation - in production, use actual email sending
    // const transporter = nodemailer.createTransport({
    //   host: config.smtpHost,
    //   port: config.smtpPort,
    //   secure: config.useTls,
    //   auth: {
    //     user: config.smtpUser,
    //     pass: config.smtpPassword
    //   }
    // });
    //
    // await transporter.sendMail({
    //   from: config.fromAddress,
    //   to: config.toAddresses.join(', '),
    //   subject: payload.title,
    //   text: payload.message,
    //   html: this.generateEmailHtml(payload)
    // });
  }

  /**
   * Send generic webhook notification
   */
  private async sendWebhookNotification(config: WebhookConfig, payload: NotificationPayload): Promise<void> {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify({
        event: payload.type,
        timestamp: new Date().toISOString(),
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  /**
   * Get Slack attachment color based on severity
   */
  private getSeverityColor(severity?: string): string {
    switch (severity) {
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'success': return 'good';
      default: return '#808080';
    }
  }

  /**
   * Get Discord embed color based on severity
   */
  private getDiscordColor(severity?: string): number {
    switch (severity) {
      case 'error': return 0xff0000;    // Red
      case 'warning': return 0xffa500;  // Orange
      case 'success': return 0x00ff00;  // Green
      default: return 0x808080;          // Gray
    }
  }

  /**
   * Convert database row to NotificationChannel
   */
  private rowToChannel(row: any): NotificationChannel {
    return {
      id: row.id,
      name: row.name,
      channelType: row.channel_type,
      config: row.config,
      isActive: row.is_active,
      createdAt: row.created_at
    };
  }

  // ==================== Convenience Methods ====================

  /**
   * Notify when a session completes successfully
   */
  async notifySessionComplete(sessionId: string, results: {
    qualityScore: number;
    testsGenerated: number;
    bugsFound: number;
    duration: string;
    url?: string;
  }): Promise<void> {
    await this.notify({
      type: 'session_complete',
      sessionId,
      title: '✅ QA Session Complete',
      message: `Quality score: ${results.qualityScore}%`,
      severity: results.qualityScore >= 80 ? 'success' : 'warning',
      metadata: {
        'Quality Score': `${results.qualityScore}%`,
        'Tests Generated': results.testsGenerated,
        'Bugs Found': results.bugsFound,
        'Duration': results.duration
      },
      url: results.url
    });
  }

  /**
   * Notify when a session fails
   */
  async notifySessionFailed(sessionId: string, error: string, url?: string): Promise<void> {
    await this.notify({
      type: 'session_failed',
      sessionId,
      title: '❌ QA Session Failed',
      message: error,
      severity: 'error',
      metadata: {
        'Session ID': sessionId,
        'Error': error.substring(0, 200)
      },
      url
    });
  }

  /**
   * Notify when a vulnerability is found
   */
  async notifyVulnerabilityFound(sessionId: string, vulnerability: {
    type: string;
    severity: string;
    page: string;
    description: string;
  }): Promise<void> {
    await this.notify({
      type: 'vulnerability_found',
      sessionId,
      title: `🚨 Vulnerability Found: ${vulnerability.type}`,
      message: vulnerability.description,
      severity: vulnerability.severity === 'critical' ? 'error' : 'warning',
      metadata: {
        'Type': vulnerability.type,
        'Severity': vulnerability.severity,
        'Page': vulnerability.page
      }
    });
  }

  /**
   * Notify when budget is exceeded
   */
  async notifyBudgetExceeded(sessionId: string, spent: number, limit: number): Promise<void> {
    await this.notify({
      type: 'budget_exceeded',
      sessionId,
      title: '💰 Budget Limit Reached',
      message: `Session stopped due to budget limit. Spent: $${(spent / 100).toFixed(4)} / Limit: $${(limit / 100).toFixed(4)}`,
      severity: 'warning',
      metadata: {
        'Spent': `$${(spent / 100).toFixed(4)}`,
        'Limit': `$${(limit / 100).toFixed(4)}`
      }
    });
  }
}

export default NotificationService;
