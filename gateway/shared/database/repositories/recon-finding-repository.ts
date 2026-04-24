import { query } from '../connection';

export type VulnClass = 'injection' | 'xss' | 'ssrf' | 'auth' | 'authz';
export type FindingStatus = 'confirmed' | 'discarded_unprovable' | 'false_positive';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface ReconFindingEntity {
  id: string;
  scan_id: string;
  vuln_class: VulnClass;
  status: FindingStatus;
  severity: Severity | null;
  impact_score: number | null;
  exploitability_score: number | null;
  blast_radius_score: number | null;
  normalized_endpoint: string | null;
  normalized_param: string | null;
  description: string;
  proof_of_concept: unknown | null;
  exploit_outcome: string | null;
  remediation: string | null;
  duplicates: unknown[];
  created_at: Date;
}

export interface CreateReconFindingInput {
  scan_id: string;
  vuln_class: VulnClass;
  status: FindingStatus;
  severity?: Severity;
  impact_score?: number;
  exploitability_score?: number;
  blast_radius_score?: number;
  normalized_endpoint?: string;
  normalized_param?: string;
  description: string;
  proof_of_concept?: unknown;
  exploit_outcome?: string;
  remediation?: string;
}

export interface ListReconFindingsOptions {
  scan_id: string;
  status?: FindingStatus;
  vuln_class?: VulnClass;
  severity?: Severity;
}

const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class ReconFindingRepository {
  /**
   * Insert a finding, deduplicating against the partial unique index on
   * (scan_id, vuln_class, normalized_endpoint, normalized_param) WHERE status='confirmed'.
   *
   * For confirmed findings the dedup policy is: keep the highest-severity row,
   * and append the incoming row's identifying fields to `duplicates`.
   */
  async insertWithDedup(input: CreateReconFindingInput): Promise<ReconFindingEntity> {
    if (input.status !== 'confirmed') {
      return this.rawInsert(input);
    }

    const existing = await query<ReconFindingEntity>(
      `SELECT * FROM recon_findings
       WHERE scan_id = $1 AND vuln_class = $2
         AND normalized_endpoint IS NOT DISTINCT FROM $3
         AND normalized_param IS NOT DISTINCT FROM $4
         AND status = 'confirmed'
       LIMIT 1`,
      [
        input.scan_id,
        input.vuln_class,
        input.normalized_endpoint ?? null,
        input.normalized_param ?? null,
      ],
    );

    if (existing.length === 0) {
      return this.rawInsert(input);
    }

    const current = existing[0];
    const incomingRank = input.severity ? SEVERITY_RANK[input.severity] : 0;
    const currentRank = current.severity ? SEVERITY_RANK[current.severity] : 0;

    // Build a duplicate marker for whichever row is losing.
    const dupMarker = {
      vuln_class: input.vuln_class,
      severity: input.severity ?? null,
      description: input.description,
      proof_of_concept: input.proof_of_concept ?? null,
    };

    if (incomingRank > currentRank) {
      // Incoming wins: replace row but carry forward existing dup history.
      const carryDuplicates = [
        ...(Array.isArray(current.duplicates) ? current.duplicates : []),
        {
          vuln_class: current.vuln_class,
          severity: current.severity,
          description: current.description,
          proof_of_concept: current.proof_of_concept,
        },
      ];
      const rows = await query<ReconFindingEntity>(
        `UPDATE recon_findings
           SET severity = $2,
               impact_score = $3,
               exploitability_score = $4,
               blast_radius_score = $5,
               description = $6,
               proof_of_concept = $7,
               exploit_outcome = $8,
               remediation = $9,
               duplicates = $10::jsonb
         WHERE id = $1
         RETURNING *`,
        [
          current.id,
          input.severity ?? null,
          input.impact_score ?? null,
          input.exploitability_score ?? null,
          input.blast_radius_score ?? null,
          input.description,
          input.proof_of_concept !== undefined ? JSON.stringify(input.proof_of_concept) : null,
          input.exploit_outcome ?? null,
          input.remediation ?? null,
          JSON.stringify(carryDuplicates),
        ],
      );
      return rows[0];
    }

    // Current wins: just append the incoming row to its duplicates list.
    const newDuplicates = [
      ...(Array.isArray(current.duplicates) ? current.duplicates : []),
      dupMarker,
    ];
    const rows = await query<ReconFindingEntity>(
      `UPDATE recon_findings SET duplicates = $2::jsonb WHERE id = $1 RETURNING *`,
      [current.id, JSON.stringify(newDuplicates)],
    );
    return rows[0];
  }

  async listByScan(options: ListReconFindingsOptions): Promise<ReconFindingEntity[]> {
    const { scan_id, status, vuln_class, severity } = options;
    const conditions: string[] = ['scan_id = $1'];
    const params: unknown[] = [scan_id];
    let idx = 2;
    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
    if (vuln_class) {
      conditions.push(`vuln_class = $${idx++}`);
      params.push(vuln_class);
    }
    if (severity) {
      conditions.push(`severity = $${idx++}`);
      params.push(severity);
    }
    return query<ReconFindingEntity>(
      `SELECT * FROM recon_findings WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ASC`,
      params,
    );
  }

  private async rawInsert(input: CreateReconFindingInput): Promise<ReconFindingEntity> {
    const rows = await query<ReconFindingEntity>(
      `INSERT INTO recon_findings
        (scan_id, vuln_class, status, severity, impact_score, exploitability_score,
         blast_radius_score, normalized_endpoint, normalized_param, description,
         proof_of_concept, exploit_outcome, remediation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.scan_id,
        input.vuln_class,
        input.status,
        input.severity ?? null,
        input.impact_score ?? null,
        input.exploitability_score ?? null,
        input.blast_radius_score ?? null,
        input.normalized_endpoint ?? null,
        input.normalized_param ?? null,
        input.description,
        input.proof_of_concept !== undefined ? JSON.stringify(input.proof_of_concept) : null,
        input.exploit_outcome ?? null,
        input.remediation ?? null,
      ],
    );
    return rows[0];
  }
}
