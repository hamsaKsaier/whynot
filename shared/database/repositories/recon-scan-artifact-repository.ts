import { query } from '../connection';

export type ReconArtifactKind = 'json' | 'text' | 'image' | 'pdf';

export interface ReconScanArtifactEntity {
  id: string;
  scan_id: string;
  phase: string;
  kind: ReconArtifactKind;
  storage_url: string;
  size_bytes: string;
  created_at: Date;
}

export interface CreateReconScanArtifactInput {
  scan_id: string;
  phase: string;
  kind: ReconArtifactKind;
  storage_url: string;
  size_bytes: number;
}

export class ReconScanArtifactRepository {
  async insert(input: CreateReconScanArtifactInput): Promise<ReconScanArtifactEntity> {
    const rows = await query<ReconScanArtifactEntity>(
      `INSERT INTO recon_scan_artifacts (scan_id, phase, kind, storage_url, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.scan_id, input.phase, input.kind, input.storage_url, input.size_bytes],
    );
    return rows[0];
  }

  async listByScan(scanId: string, phase?: string): Promise<ReconScanArtifactEntity[]> {
    if (phase) {
      return query<ReconScanArtifactEntity>(
        `SELECT * FROM recon_scan_artifacts WHERE scan_id = $1 AND phase = $2
         ORDER BY created_at ASC`,
        [scanId, phase],
      );
    }
    return query<ReconScanArtifactEntity>(
      `SELECT * FROM recon_scan_artifacts WHERE scan_id = $1
       ORDER BY created_at ASC`,
      [scanId],
    );
  }
}
