/**
 * Session Plan — Layer 2 of the context architecture.
 *
 * Created by QA Lead at the start of a scan. Read by all agents to know
 * their objectives, priorities, and dependencies.
 */
import { query } from '../../../shared/database/connection';
import { createLogger } from '../../../shared/logger/logger';
import { SessionPlan, AppAnalysis, PlanObjective, PlanStatus } from './types';

const logger = createLogger('session-plan');

export class SessionPlanStore {
  /**
   * Create a new session plan (called by QA Lead).
   */
  async create(
    sessionId: string,
    appAnalysis: AppAnalysis,
    objectives: PlanObjective[],
    createdBy: string = 'qa_lead'
  ): Promise<SessionPlan> {
    const rows = await query<SessionPlan>(
      `INSERT INTO qa_session_plans (session_id, created_by, app_analysis, objectives)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sessionId, createdBy, JSON.stringify(appAnalysis), JSON.stringify(objectives)]
    );

    logger.info('Session plan created', {
      sessionId,
      objectiveCount: objectives.length,
      agents: objectives.map(o => o.agent),
    });

    return rows[0];
  }

  /**
   * Get the active plan for a session.
   */
  async getForSession(sessionId: string): Promise<SessionPlan | null> {
    const rows = await query<SessionPlan>(
      `SELECT * FROM qa_session_plans
       WHERE session_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    return rows[0] || null;
  }

  /**
   * Get objectives assigned to a specific agent.
   */
  async getObjectivesForAgent(sessionId: string, agentType: string): Promise<PlanObjective[]> {
    const plan = await this.getForSession(sessionId);
    if (!plan) return [];

    const objectives = Array.isArray(plan.objectives) ? plan.objectives : [];
    return objectives.filter(o => o.agent === agentType);
  }

  /**
   * Update plan status.
   */
  async updateStatus(sessionId: string, status: PlanStatus): Promise<void> {
    await query(
      `UPDATE qa_session_plans SET status = $1 WHERE session_id = $2`,
      [status, sessionId]
    );
  }
}
