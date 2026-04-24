import { query } from '../connection';

/**
 * Per-scan legal authorization record. This table is append-only: the
 * application layer MUST NOT expose any UPDATE method on it (recon-safety
 * rule 1). Only `insert` and `findByScanId` are provided here.
 */
export interface ReconScanAuthorizationEntity {
  id: string;
  scan_id: string;
  acknowledged_by_user_id: string;
  acknowledged_at: Date;
  justification: string;
  caller_ip: string;
  user_agent: string;
  created_at: Date;
}

export interface CreateReconScanAuthorizationInput {
  scan_id: string;
  acknowledged_by_user_id: string;
  acknowledged_at: Date;
  justification: string;
  caller_ip: string;
  user_agent: string;
}

export class ReconScanAuthorizationRepository {
  async insert(
    input: CreateReconScanAuthorizationInput,
  ): Promise<ReconScanAuthorizationEntity> {
    if (input.justification.length < 20 || input.justification.length > 1000) {
      throw new Error(
        'recon authorization justification must be between 20 and 1000 characters',
      );
    }
    const rows = await query<ReconScanAuthorizationEntity>(
      `INSERT INTO recon_scan_authorizations
        (scan_id, acknowledged_by_user_id, acknowledged_at, justification, caller_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5::inet, $6)
       RETURNING *`,
      [
        input.scan_id,
        input.acknowledged_by_user_id,
        input.acknowledged_at,
        input.justification,
        input.caller_ip,
        input.user_agent,
      ],
    );
    return rows[0];
  }

  async findByScanId(scanId: string): Promise<ReconScanAuthorizationEntity | null> {
    const rows = await query<ReconScanAuthorizationEntity>(
      `SELECT * FROM recon_scan_authorizations WHERE scan_id = $1`,
      [scanId],
    );
    return rows[0] ?? null;
  }
}
