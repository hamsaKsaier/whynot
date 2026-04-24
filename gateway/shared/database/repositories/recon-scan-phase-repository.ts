import { query } from '../connection';

export type ReconPhase =
  | 'fingerprinting'
  | 'discovery'
  | 'vuln_analysis'
  | 'exploitation'
  | 'reporting';

export type ReconPhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface ReconScanPhaseEntity {
  id: string;
  scan_id: string;
  phase: ReconPhase;
  status: ReconPhaseStatus;
  started_at: Date | null;
  completed_at: Date | null;
  output_artifact_id: string | null;
  error_message: string | null;
}

export interface CheckpointInput {
  scan_id: string;
  phase: ReconPhase;
  status: ReconPhaseStatus;
  output_artifact_id?: string | null;
  error_message?: string | null;
}

export class ReconScanPhaseRepository {
  /**
   * Upsert a phase checkpoint. Sets started_at on first transition to running,
   * completed_at on any terminal status (completed/failed/skipped/cancelled).
   */
  async checkpoint(input: CheckpointInput): Promise<ReconScanPhaseEntity> {
    const isRunning = input.status === 'running';
    const isTerminal =
      input.status === 'completed' ||
      input.status === 'failed' ||
      input.status === 'skipped' ||
      input.status === 'cancelled';

    const rows = await query<ReconScanPhaseEntity>(
      `INSERT INTO recon_scan_phases
        (scan_id, phase, status, started_at, completed_at, output_artifact_id, error_message)
       VALUES ($1, $2, $3,
               CASE WHEN $4 THEN now() ELSE NULL END,
               CASE WHEN $5 THEN now() ELSE NULL END,
               $6, $7)
       ON CONFLICT (scan_id, phase) DO UPDATE
         SET status = EXCLUDED.status,
             started_at = CASE
               WHEN $4 AND recon_scan_phases.started_at IS NULL THEN now()
               ELSE recon_scan_phases.started_at
             END,
             completed_at = CASE
               WHEN $5 THEN now()
               ELSE recon_scan_phases.completed_at
             END,
             output_artifact_id = COALESCE(EXCLUDED.output_artifact_id, recon_scan_phases.output_artifact_id),
             error_message = EXCLUDED.error_message
       RETURNING *`,
      [
        input.scan_id,
        input.phase,
        input.status,
        isRunning,
        isTerminal,
        input.output_artifact_id ?? null,
        input.error_message ?? null,
      ],
    );
    return rows[0];
  }

  async listByScan(scanId: string): Promise<ReconScanPhaseEntity[]> {
    return query<ReconScanPhaseEntity>(
      `SELECT * FROM recon_scan_phases WHERE scan_id = $1
       ORDER BY
         CASE phase
           WHEN 'fingerprinting' THEN 1
           WHEN 'discovery' THEN 2
           WHEN 'vuln_analysis' THEN 3
           WHEN 'exploitation' THEN 4
           WHEN 'reporting' THEN 5
         END`,
      [scanId],
    );
  }
}
