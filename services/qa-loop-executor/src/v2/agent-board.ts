/**
 * Agent Board — Layer 3 of the context architecture.
 *
 * Real-time coordination between agents via the database.
 * Agents write discoveries, read what others found, and send messages.
 */
import { query } from '../../../shared/database/connection';
import { createLogger } from '../../../shared/logger/logger';
import { AgentType, AgentStatus, AgentBoardEntry, BoardDiscovery, BoardMessage } from './types';

const logger = createLogger('agent-board');

export class AgentBoard {
  /**
   * Initialize a board entry for an agent when it starts.
   * Uses UPSERT to be idempotent.
   */
  async initialize(sessionId: string, agentType: AgentType): Promise<AgentBoardEntry> {
    const rows = await query<AgentBoardEntry>(
      `INSERT INTO qa_agent_board (session_id, agent_type, status)
       VALUES ($1, $2, 'idle')
       ON CONFLICT (session_id, agent_type)
       DO UPDATE SET status = 'idle', updated_at = NOW()
       RETURNING *`,
      [sessionId, agentType]
    );
    return rows[0];
  }

  /**
   * Update agent status and current task.
   */
  async updateStatus(
    sessionId: string,
    agentType: AgentType,
    status: AgentStatus,
    currentTask?: string,
    progressPct?: number
  ): Promise<void> {
    const sets: string[] = ['status = $3'];
    const params: any[] = [sessionId, agentType, status];
    let idx = 4;

    if (currentTask !== undefined) {
      sets.push(`current_task = $${idx++}`);
      params.push(currentTask);
    }
    if (progressPct !== undefined) {
      sets.push(`progress_pct = $${idx++}`);
      params.push(progressPct);
    }

    await query(
      `UPDATE qa_agent_board SET ${sets.join(', ')}
       WHERE session_id = $1 AND agent_type = $2`,
      params
    );
  }

  /**
   * Append a discovery to the agent's board entry.
   * Uses JSONB array append for atomic updates.
   */
  async addDiscovery(
    sessionId: string,
    agentType: AgentType,
    discovery: Omit<BoardDiscovery, 'at'>
  ): Promise<void> {
    const timestamped = { ...discovery, at: new Date().toISOString() };

    await query(
      `UPDATE qa_agent_board
       SET discoveries = discoveries || $3::jsonb
       WHERE session_id = $1 AND agent_type = $2`,
      [sessionId, agentType, JSON.stringify([timestamped])]
    );
  }

  /**
   * Send a message to another agent (or broadcast to all).
   */
  async sendMessage(
    sessionId: string,
    fromAgent: AgentType,
    to: AgentType | 'all',
    msg: string
  ): Promise<void> {
    const message: BoardMessage = { to, msg, at: new Date().toISOString() };

    await query(
      `UPDATE qa_agent_board
       SET messages = messages || $3::jsonb
       WHERE session_id = $1 AND agent_type = $2`,
      [sessionId, fromAgent, JSON.stringify([message])]
    );
  }

  /**
   * Read all discoveries from other agents since a given timestamp.
   * This is the core polling mechanism — called every N tool calls.
   */
  async getDiscoveriesSince(
    sessionId: string,
    excludeAgent: AgentType,
    sinceTimestamp?: string
  ): Promise<{ agent: AgentType; discoveries: BoardDiscovery[] }[]> {
    const rows = await query<AgentBoardEntry>(
      `SELECT agent_type, discoveries FROM qa_agent_board
       WHERE session_id = $1 AND agent_type != $2`,
      [sessionId, excludeAgent]
    );

    return rows.map(row => {
      let discoveries = Array.isArray(row.discoveries) ? row.discoveries : [];
      if (sinceTimestamp) {
        discoveries = discoveries.filter(d => d.at > sinceTimestamp);
      }
      return { agent: row.agent_type, discoveries };
    }).filter(r => r.discoveries.length > 0);
  }

  /**
   * Read messages addressed to this agent (or broadcast to 'all').
   */
  async getMessagesFor(
    sessionId: string,
    agentType: AgentType,
    sinceTimestamp?: string
  ): Promise<{ from: AgentType; messages: BoardMessage[] }[]> {
    const rows = await query<AgentBoardEntry>(
      `SELECT agent_type, messages FROM qa_agent_board
       WHERE session_id = $1 AND agent_type != $2`,
      [sessionId, agentType]
    );

    return rows.map(row => {
      let msgs = Array.isArray(row.messages) ? row.messages : [];
      msgs = msgs.filter(m => m.to === agentType || m.to === 'all');
      if (sinceTimestamp) {
        msgs = msgs.filter(m => m.at > sinceTimestamp);
      }
      return { from: row.agent_type, messages: msgs };
    }).filter(r => r.messages.length > 0);
  }

  /**
   * Get all board entries for a session (used by QA Lead for synthesis).
   */
  async getAllForSession(sessionId: string): Promise<AgentBoardEntry[]> {
    return await query<AgentBoardEntry>(
      `SELECT * FROM qa_agent_board WHERE session_id = $1 ORDER BY created_at`,
      [sessionId]
    );
  }

  /**
   * Update metrics counters for an agent.
   */
  async updateMetrics(
    sessionId: string,
    agentType: AgentType,
    metrics: {
      pages_explored?: number;
      tests_generated?: number;
      bugs_found?: number;
      api_endpoints_tested?: number;
    }
  ): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [sessionId, agentType];
    let idx = 3;

    for (const [key, value] of Object.entries(metrics)) {
      if (value !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }

    if (sets.length === 0) return;

    await query(
      `UPDATE qa_agent_board SET ${sets.join(', ')}
       WHERE session_id = $1 AND agent_type = $2`,
      params
    );
  }

  /**
   * Check if dependencies are met for an agent to start.
   * Returns true if all depended-on agents have status 'working' or 'done'
   * AND have at least one discovery to work with.
   */
  async areDependenciesMet(
    sessionId: string,
    dependsOnAgents: AgentType[]
  ): Promise<boolean> {
    if (dependsOnAgents.length === 0) return true;

    const rows = await query<AgentBoardEntry>(
      `SELECT agent_type, status, discoveries FROM qa_agent_board
       WHERE session_id = $1 AND agent_type = ANY($2)`,
      [sessionId, dependsOnAgents]
    );

    // All depended-on agents must exist and have started producing data
    for (const agent of dependsOnAgents) {
      const entry = rows.find(r => r.agent_type === agent);
      if (!entry) return false;

      // Soft dependency: agent is working/done AND has at least 1 discovery
      const hasData = Array.isArray(entry.discoveries) && entry.discoveries.length > 0;
      const isActive = entry.status === 'working' || entry.status === 'done';
      if (!isActive || !hasData) return false;
    }

    return true;
  }
}
