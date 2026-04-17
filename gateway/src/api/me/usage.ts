import { Router } from 'express';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { UsageEventRepository } from '../../../shared/database/repositories/usage-event-repository';
import { BillingService } from '../../payments/billing-service';

const router = Router();
const repo = new UsageEventRepository();

function parseDateRange(req: any): { from: Date; to: Date } {
  const now = new Date();
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;

  const to = toStr ? new Date(toStr) : now;
  const from = fromStr ? new Date(fromStr) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw createError('Invalid date range', 400, 'INVALID_DATE_RANGE', undefined, 'errors:validation.invalidDateRange');
  }

  return { from, to };
}

router.get('/summary', asyncHandler(async (req: any, res) => {
  const { from, to } = parseDateRange(req);
  const summary = await repo.summaryForOrg(req.workspaceId, { from, to });

  let paygBalanceCents = '0';
  try {
    const balance = await BillingService.currentPaygBalance(req.workspaceId);
    paygBalanceCents = balance.toString();
  } catch {
    // workspace may not have PAYG — ignore
  }

  res.json({
    success: true,
    summary: {
      totalEvents: summary.totalEvents,
      totalCharged: summary.totalCharged,
      totalCredits: summary.totalCredits.toString(),
      paygBalanceCents,
    },
  });
}));

router.get('/by-day', asyncHandler(async (req: any, res) => {
  const { from, to } = parseDateRange(req);
  const rows = await repo.aggregateByDayAndType(req.workspaceId, { from, to });

  res.json({
    success: true,
    days: rows.map((r: any) => ({
      day: r.day,
      eventType: r.event_type,
      totalEvents: r.total_events,
      totalQuantity: r.total_quantity,
      totalCredits: r.total_credits.toString(),
    })),
  });
}));

router.get('/recent', asyncHandler(async (req: any, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const eventType = req.query.eventType as string | undefined;

  const result = await repo.listByOrg(req.workspaceId, { cursor, limit, eventType });

  res.json({
    success: true,
    entries: result.entries.map((e: any) => ({
      id: e.id,
      eventType: e.event_type,
      quantity: e.quantity,
      creditsConsumed: e.credits_consumed.toString(),
      metadata: e.metadata,
      createdAt: e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
    })),
    nextCursor: result.nextCursor,
  });
}));

router.get('/export.csv', asyncHandler(async (req: any, res) => {
  const { from, to } = parseDateRange(req);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="usage-events-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv"`);

  res.write('id,event_type,quantity,credits_consumed,metadata,created_at\n');

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await repo.listByOrg(req.workspaceId, { cursor, limit: 100 });

    for (const e of page.entries) {
      const createdAt = e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at;
      if (new Date(createdAt) < from) {
        hasMore = false;
        break;
      }
      if (new Date(createdAt) > to) continue;

      const metaStr = JSON.stringify(e.metadata).replace(/"/g, '""');
      res.write(`${e.id},${e.event_type},${e.quantity},${e.credits_consumed},"${metaStr}",${createdAt}\n`);
    }

    if (!page.nextCursor) {
      hasMore = false;
    } else {
      cursor = page.nextCursor;
    }
  }

  res.end();
}));

export const meUsageRouter = router;
