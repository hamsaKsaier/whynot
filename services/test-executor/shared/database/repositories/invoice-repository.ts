import { query } from '../connection';

export interface InvoiceEntity {
  id: string;
  workspace_id: string;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  amount_cents: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  period_start: Date | null;
  period_end: Date | null;
  paid_at: Date | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: Date;
}

export interface CreateInvoiceInput {
  workspace_id: string;
  stripe_invoice_id?: string;
  stripe_charge_id?: string;
  amount_cents: number;
  currency?: string;
  status?: string;
  period_start?: Date;
  period_end?: Date;
  paid_at?: Date;
  invoice_url?: string;
  invoice_pdf?: string;
}

export class InvoiceRepository {
  async create(input: CreateInvoiceInput): Promise<InvoiceEntity> {
    const result = await query<InvoiceEntity>(
      `INSERT INTO invoices
         (workspace_id, stripe_invoice_id, stripe_charge_id, amount_cents, currency, status, period_start, period_end, paid_at, invoice_url, invoice_pdf)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.workspace_id,
        input.stripe_invoice_id || null,
        input.stripe_charge_id || null,
        input.amount_cents,
        input.currency || 'usd',
        input.status || 'draft',
        input.period_start || null,
        input.period_end || null,
        input.paid_at || null,
        input.invoice_url || null,
        input.invoice_pdf || null,
      ]
    );
    return result[0];
  }

  async findByWorkspaceId(workspaceId: string, limit: number = 50): Promise<InvoiceEntity[]> {
    return query<InvoiceEntity>(
      'SELECT * FROM invoices WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2',
      [workspaceId, limit]
    );
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<InvoiceEntity | null> {
    const result = await query<InvoiceEntity>(
      'SELECT * FROM invoices WHERE stripe_invoice_id = $1',
      [stripeInvoiceId]
    );
    return result[0] || null;
  }

  async updateStatus(id: string, status: string, paidAt?: Date): Promise<InvoiceEntity | null> {
    const result = await query<InvoiceEntity>(
      `UPDATE invoices SET status = $1, paid_at = COALESCE($2, paid_at) WHERE id = $3 RETURNING *`,
      [status, paidAt || null, id]
    );
    return result[0] || null;
  }

  async updateByStripeInvoiceId(
    stripeInvoiceId: string,
    updates: Partial<Pick<InvoiceEntity, 'status' | 'paid_at' | 'invoice_url' | 'invoice_pdf' | 'stripe_charge_id'>>
  ): Promise<InvoiceEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.paid_at !== undefined) { fields.push(`paid_at = $${idx++}`); values.push(updates.paid_at); }
    if (updates.invoice_url !== undefined) { fields.push(`invoice_url = $${idx++}`); values.push(updates.invoice_url); }
    if (updates.invoice_pdf !== undefined) { fields.push(`invoice_pdf = $${idx++}`); values.push(updates.invoice_pdf); }
    if (updates.stripe_charge_id !== undefined) { fields.push(`stripe_charge_id = $${idx++}`); values.push(updates.stripe_charge_id); }

    if (fields.length === 0) return this.findByStripeInvoiceId(stripeInvoiceId);

    values.push(stripeInvoiceId);
    const result = await query<InvoiceEntity>(
      `UPDATE invoices SET ${fields.join(', ')} WHERE stripe_invoice_id = $${idx} RETURNING *`,
      values
    );
    return result[0] || null;
  }
}
