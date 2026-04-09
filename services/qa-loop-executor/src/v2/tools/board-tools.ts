/**
 * Board Tools — tools that agents use to read/write the shared board.
 *
 * These are registered as AI tools so agents can coordinate through
 * the board within their normal tool-calling loop.
 */
import { AgentBoard } from '../agent-board';
import { AgentType, BoardDiscovery } from '../types';
import { ToolResult } from '../../tool-executor';

export class BoardTools {
  private board: AgentBoard;
  private sessionId: string;
  private agentType: AgentType;

  constructor(sessionId: string, agentType: AgentType) {
    this.board = new AgentBoard();
    this.sessionId = sessionId;
    this.agentType = agentType;
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
