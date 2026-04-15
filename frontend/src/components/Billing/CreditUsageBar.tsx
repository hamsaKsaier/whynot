import React from 'react';
import { useTranslation } from 'react-i18next';

interface CreditUsageBarProps {
  used: number;
  total: number;
  remaining: number;
}

export const CreditUsageBar: React.FC<CreditUsageBarProps> = ({ used, total, remaining }) => {
  const { t } = useTranslation('billing');
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-colors duration-150`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{t('billingTab.creditsUsed', { count: used })}</span>
        <span>{remaining} {t('billing.credits.remaining')}</span>
      </div>
    </div>
  );
};
