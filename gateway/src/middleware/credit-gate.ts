import { Request, Response, NextFunction } from 'express';
import { CreditRepository } from '../../shared/database/repositories/credit-repository';
import { BillingService } from '../services/billing-service';
import { getCreditCost, getCreditDescription, CreditCostKey } from '../services/credit-cost-mapper';

const creditRepository = new CreditRepository();
const billingService = new BillingService();

/**
 * Middleware that checks if the workspace has enough credits for an operation.
 * Returns 402 Payment Required if insufficient credits.
 *
 * Usage: requireCredits('TEST_GENERATION') or requireCredits(5)
 */
export function requireCredits(costOrKey: CreditCostKey | number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: 'Workspace not resolved' });
        return;
      }

      const cost = typeof costOrKey === 'number' ? costOrKey : getCreditCost(costOrKey);

      const { hasEnough, balance } = await billingService.checkCreditBalance(workspaceId, cost);

      if (!hasEnough) {
        res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          details: {
            required: cost,
            available: balance,
            upgrade_url: '/billing',
          },
        });
        return;
      }

      // Attach cost info for post-operation deduction
      (req as any)._creditCost = cost;
      (req as any)._creditOperation = typeof costOrKey === 'string' ? costOrKey : undefined;

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Deduct credits after a successful operation.
 * Call this in route handlers after the operation succeeds.
 */
export async function deductCredits(
  workspaceId: string,
  operation: CreditCostKey,
  detail?: string,
  referenceType?: string,
  referenceId?: string
): Promise<void> {
  const cost = getCreditCost(operation);
  const description = getCreditDescription(operation, detail);

  await billingService.consumeCredits(
    workspaceId,
    cost,
    description,
    referenceType,
    referenceId
  );
}
