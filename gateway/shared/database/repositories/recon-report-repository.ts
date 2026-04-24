import { query } from '../connection';

export interface ReconReportSummary {
  total: number;
  by_severity: Record<string, number>;
  by_class: Record<string, number>;
}

export interface ReconReportEntity {
  id: string;
  scan_id: string;
  markdown: string;
  pdf_url: string | null;
  summary: ReconReportSummary;
  generated_at: Date;
}

export interface CreateReconReportInput {
  scan_id: string;
  markdown: string;
  summary: ReconReportSummary;
  pdf_url?: string;
}

export class ReconReportRepository {
  async upsert(input: CreateReconReportInput): Promise<ReconReportEntity> {
    const rows = await query<ReconReportEntity>(
      `INSERT INTO recon_reports (scan_id, markdown, summary, pdf_url)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (scan_id) DO UPDATE
         SET markdown = EXCLUDED.markdown,
             summary = EXCLUDED.summary,
             pdf_url = EXCLUDED.pdf_url,
             generated_at = now()
       RETURNING *`,
      [
        input.scan_id,
        input.markdown,
        JSON.stringify(input.summary),
        input.pdf_url ?? null,
      ],
    );
    return rows[0];
  }

  async findByScanId(scanId: string): Promise<ReconReportEntity | null> {
    const rows = await query<ReconReportEntity>(
      `SELECT * FROM recon_reports WHERE scan_id = $1`,
      [scanId],
    );
    return rows[0] ?? null;
  }
}
