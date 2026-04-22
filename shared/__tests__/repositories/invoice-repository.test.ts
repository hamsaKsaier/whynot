import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { InvoiceRepository } from '../../database/repositories/invoice-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('InvoiceRepository', () => {
  const repo = new InvoiceRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts invoice with defaults', async () => {
      const invoice = { id: 'inv1' };
      mockQuery.mockResolvedValue([invoice]);
      const result = await repo.create({ workspace_id: 'ws1', amount_cents: 1000 });
      expect(result).toEqual(invoice);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoices'),
        ['ws1', null, null, 1000, 'usd', 'draft', null, null, null, null, null],
      );
    });

    it('passes all optional fields', async () => {
      const paidAt = new Date();
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      await repo.create({
        workspace_id: 'ws1',
        stripe_invoice_id: 'si1',
        stripe_charge_id: 'sc1',
        amount_cents: 5000,
        currency: 'eur',
        status: 'paid',
        period_start: new Date('2025-01-01'),
        period_end: new Date('2025-01-31'),
        paid_at: paidAt,
        invoice_url: 'https://stripe.com/inv',
        invoice_pdf: 'https://stripe.com/pdf',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoices'),
        expect.arrayContaining(['si1', 'sc1', 5000, 'eur', 'paid']),
      );
    });
  });

  describe('findByWorkspaceId', () => {
    it('returns invoices with default limit', async () => {
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      const result = await repo.findByWorkspaceId('ws1');
      expect(result).toEqual([{ id: 'inv1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $1'),
        ['ws1', 50],
      );
    });

    it('uses custom limit', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.findByWorkspaceId('ws1', 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['ws1', 10],
      );
    });
  });

  describe('findByStripeInvoiceId', () => {
    it('returns invoice when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      expect(await repo.findByStripeInvoiceId('si1')).toEqual({ id: 'inv1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByStripeInvoiceId('missing')).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('updates status', async () => {
      mockQuery.mockResolvedValue([{ id: 'inv1', status: 'paid' }]);
      const result = await repo.updateStatus('inv1', 'paid');
      expect(result).toEqual({ id: 'inv1', status: 'paid' });
    });

    it('updates status with paid_at', async () => {
      const paidAt = new Date();
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      await repo.updateStatus('inv1', 'paid', paidAt);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET status'),
        ['paid', paidAt, 'inv1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateStatus('missing', 'void')).toBeNull();
    });
  });

  describe('updateByStripeInvoiceId', () => {
    it('updates fields by stripe invoice id', async () => {
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      const result = await repo.updateByStripeInvoiceId('si1', { status: 'paid' });
      expect(result).toEqual({ id: 'inv1' });
    });

    it('falls back to findByStripeInvoiceId when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      await repo.updateByStripeInvoiceId('si1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('stripe_invoice_id = $1'),
        ['si1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateByStripeInvoiceId('missing', { status: 'void' })).toBeNull();
    });

    it('updates multiple fields', async () => {
      const paidAt = new Date();
      mockQuery.mockResolvedValue([{ id: 'inv1' }]);
      await repo.updateByStripeInvoiceId('si1', {
        status: 'paid',
        paid_at: paidAt,
        invoice_url: 'url',
        invoice_pdf: 'pdf',
        stripe_charge_id: 'ch1',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET'),
        ['paid', paidAt, 'url', 'pdf', 'ch1', 'si1'],
      );
    });
  });
});
