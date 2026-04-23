/**
 * Board Tools — tools that agents use to read/write the shared board.
 *
 * These are registered as AI tools so agents can coordinate through
 * the board within their normal tool-calling loop.
 *
 * v4 Phase 1: when an AgentEventBus is present, every writeToBoard call
 * ALSO publishes a typed event (page.discovered / form.discovered /
 * endpoint.discovered / bug.confirmed) for live peer subscription. The
 * DB board write is unchanged — the bus is additive.
 */
import { AgentBoard } from '../agent-board';
import { AgentType, BoardDiscovery } from '../types';
import { ToolResult } from '../../tool-executor';
import { AgentEventBus, deriveFormId } from '../agent-event-bus';

export class BoardTools {
  private board: AgentBoard;
  private sessionId: string;
  private agentType: AgentType;
  private bus: AgentEventBus | null;

  constructor(sessionId: string, agentType: AgentType, bus: AgentEventBus | null = null) {
    this.board = new AgentBoard();
    this.sessionId = sessionId;
    this.agentType = agentType;
    this.bus = bus;
  }

  /**
   * Write a discovery to the shared board.
   */
  async writeToBoard(input: {
    type: string;
    title?: string;
    page?: string;
    url?: string;
    fields?: string[];
    method?: string;
    path?: string;
    severity?: string;
    description?: string;
    auth_required?: boolean;
    reason?: string;
    [key: string]: any;
  }): Promise<ToolResult> {
    try {
      const { type, ...rest } = input;
      await this.board.addDiscovery(this.sessionId, this.agentType, {
        type: type as BoardDiscovery['type'],
        ...rest,
      });

      // v4 Phase 1: mirror to the event bus so peers subscribing to this
      // type receive it live. No-op when bus is null (feature flag off).
      // Each branch normalizes the BoardDiscovery shape (which is loose,
      // keyed on `type` + extra props) into the strict AgentEvent shape.
      if (this.bus) {
        const at = new Date().toISOString();
        const url = (input.url || input.page || '') as string;
        try {
          switch (type) {
            case 'page':
              if (url) {
                this.bus.publish({
                  type: 'page.discovered',
                  agent: this.agentType,
                  at,
                  data: {
                    url,
                    pageId: url,
                    authRequired: !!input.auth_required,
                  },
                });
              }
              break;
            case 'form': {
              const fields = Array.isArray(input.fields) ? input.fields.map(String) : [];
              if (url) {
                this.bus.publish({
                  type: 'form.discovered',
                  agent: this.agentType,
                  at,
                  data: {
                    url,
                    formId: deriveFormId(url, fields),
                    fields,
                    method: input.method,
                  },
                });
              }
              break;
            }
            case 'api_endpoint':
              if (url || input.path) {
                this.bus.publish({
                  type: 'endpoint.discovered',
                  agent: this.agentType,
                  at,
                  data: {
                    url: url || (input.path as string) || '',
                    method: (input.method || 'GET') as string,
                    path: input.path as string | undefined,
                  },
                });
              }
              break;
            case 'bug':
            case 'security_issue':
              if (input.title) {
                this.bus.publish({
                  type: 'bug.confirmed',
                  agent: this.agentType,
                  at,
                  // bugId falls back to the deduped title so the event
                  // stream has a stable key even though BoardTools never
                  // sees the DB-assigned UUID (that's in ReportTools).
                  data: {
                    bugId: (input.title as string),
                    severity: (input.severity || 'medium') as string,
                    title: input.title as string,
                    pageUrl: url || undefined,
                  },
                });
              }
              break;
          }
        } catch {
          // Bus publish failures are non-fatal — the DB write already
          // succeeded and that's the persistent record of truth.
        }
      }

      return {
        data: {
          success: true,
          message: `Discovery written to board: [${type}] ${input.title || input.page || input.path || 'noted'}`,
        },
      };
    } catch (err: any) {
      return { error: `Failed to write to board: ${err.message}` };
    }
  }

  /**
   * Read recent discoveries from other agents.
   */
  async readBoard(input: { type_filter?: string }): Promise<ToolResult> {
    try {
      const updates = await this.board.getDiscoveriesSince(
        this.sessionId,
        this.agentType
      );

      const allDiscoveries = updates.flatMap(u =>
        u.discoveries.map(d => ({ agent: u.agent, ...d }))
      );

      let filtered = allDiscoveries;
      if (input.type_filter) {
        filtered = allDiscoveries.filter(d => d.type === input.type_filter);
      }

      return {
        data: {
          count: filtered.length,
          discoveries: filtered.slice(0, 20),
        },
      };
    } catch (err: any) {
      return { error: `Failed to read board: ${err.message}` };
    }
  }

  /**
   * Send a message to another agent.
   */
  async sendAgentMessage(input: { to: string; message: string }): Promise<ToolResult> {
    try {
      await this.board.sendMessage(
        this.sessionId,
        this.agentType,
        input.to as AgentType | 'all',
        input.message
      );

      return {
        data: { success: true, message: `Message sent to ${input.to}` },
      };
    } catch (err: any) {
      return { error: `Failed to send message: ${err.message}` };
    }
  }
}
