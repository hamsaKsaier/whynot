import { UsageEventRepository, CreateUsageEventInput } from '../../shared/database/repositories/usage-event-repository';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('usage-tracker');
const repo = new UsageEventRepository();

export interface UsageEventInput {
  workspaceId: string;
  userId?: string;
  eventType: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 100;

let buffer: CreateUsageEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function toDbInput(input: UsageEventInput): CreateUsageEventInput {
  return {
    workspace_id: input.workspaceId,
    user_id: input.userId,
    event_type: input.eventType,
    quantity: input.quantity ?? 1,
    metadata: input.metadata,
  };
}

export function recordUsageEvent(input: UsageEventInput): void {
  buffer.push(toDbInput(input));

  if (buffer.length >= MAX_BATCH_SIZE) {
    flush().catch(() => {});
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flush().catch(() => {});
    }, FLUSH_INTERVAL_MS);
  }
}

export async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (buffer.length === 0) return;

  const batch = buffer.splice(0);

  try {
    await repo.insertBatch(batch);
    logger.info('Flushed usage events', { count: batch.length });

    await forwardPaygEvents(batch);
  } catch (err) {
    logger.error('Failed to flush usage events', err, { count: batch.length });
  }
}

async function forwardPaygEvents(batch: CreateUsageEventInput[]): Promise<void> {
  const { SubscriptionManager } = await import('../payments/subscription-manager');
  const { BillingService } = await import('../payments/billing-service');
  const { DEFAULT_PAYG_RATES } = await import('../../shared/constants/pricing');

  const byWorkspace = new Map<string, CreateUsageEventInput[]>();
  for (const event of batch) {
    const list = byWorkspace.get(event.workspace_id) ?? [];
    list.push(event);
    byWorkspace.set(event.workspace_id, list);
  }

  for (const [workspaceId, events] of byWorkspace) {
    try {
      const isPayg = await SubscriptionManager.isManagedPaygTier(workspaceId);
      if (!isPayg) continue;

      for (const event of events) {
        const rate = DEFAULT_PAYG_RATES[event.event_type];
        if (!rate || rate === 0n) continue;

        await BillingService.recordUsageEvent(
          {
            orgId: workspaceId,
            eventType: event.event_type,
            quantity: event.quantity ?? 1,
            metadata: event.metadata,
          },
          { userId: event.user_id ?? 'system', orgId: workspaceId },
        ).catch((err) => {
          logger.error('PAYG ledger debit failed', err, {
            workspaceId,
            eventType: event.event_type,
          });
        });
      }
    } catch (err) {
      logger.error('PAYG forwarding failed for workspace', err, { workspaceId });
    }
  }
}

function gracefulFlush(): void {
  flush().catch(() => {});
}

process.on('SIGTERM', gracefulFlush);
process.on('SIGINT', gracefulFlush);
process.on('beforeExit', gracefulFlush);

export function _testReset(): void {
  buffer = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

export function _testGetBuffer(): CreateUsageEventInput[] {
  return buffer;
}
