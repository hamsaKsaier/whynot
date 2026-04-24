import { query } from '../connection';

export interface ReconWorkspaceSettingsEntity {
  workspace_id: string;
  notify_recipient_user_ids: string[];
  email_on_complete: boolean;
  email_on_fail: boolean;
  payg_cap_credits: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertReconWorkspaceSettingsInput {
  workspace_id: string;
  notify_recipient_user_ids: string[];
  email_on_complete: boolean;
  email_on_fail: boolean;
  payg_cap_credits: number;
}

const MAX_PAYG_CAP_CREDITS = 100_000;

export class ReconWorkspaceSettingsRepository {
  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<ReconWorkspaceSettingsEntity | null> {
    const rows = await query<ReconWorkspaceSettingsEntity>(
      `SELECT * FROM recon_workspace_settings WHERE workspace_id = $1`,
      [workspaceId],
    );
    return rows[0] ?? null;
  }

  async upsert(
    input: UpsertReconWorkspaceSettingsInput,
  ): Promise<ReconWorkspaceSettingsEntity> {
    if (
      !Number.isInteger(input.payg_cap_credits) ||
      input.payg_cap_credits < 0 ||
      input.payg_cap_credits > MAX_PAYG_CAP_CREDITS
    ) {
      throw new Error(
        `payg_cap_credits must be an integer between 0 and ${MAX_PAYG_CAP_CREDITS}`,
      );
    }
    const rows = await query<ReconWorkspaceSettingsEntity>(
      `INSERT INTO recon_workspace_settings
        (workspace_id, notify_recipient_user_ids, email_on_complete, email_on_fail, payg_cap_credits, updated_at)
       VALUES ($1, $2::uuid[], $3, $4, $5, NOW())
       ON CONFLICT (workspace_id) DO UPDATE SET
         notify_recipient_user_ids = EXCLUDED.notify_recipient_user_ids,
         email_on_complete = EXCLUDED.email_on_complete,
         email_on_fail = EXCLUDED.email_on_fail,
         payg_cap_credits = EXCLUDED.payg_cap_credits,
         updated_at = NOW()
       RETURNING *`,
      [
        input.workspace_id,
        input.notify_recipient_user_ids,
        input.email_on_complete,
        input.email_on_fail,
        input.payg_cap_credits,
      ],
    );
    return rows[0];
  }
}
