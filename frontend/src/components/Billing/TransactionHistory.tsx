import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  const { t, i18n } = useTranslation('billing');

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t('billingTab.creditHistory.empty', 'No credit transactions yet')}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: card stack */}
      <div className="space-y-3 md:hidden">
        {transactions.map((txn) => (
          <Card key={txn.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{formatDate(txn.created_at)}</span>
                <Badge variant={txn.amount > 0 ? 'default' : 'secondary'}>
                  {t(`billingTab.txnType.${txn.type}`, txn.type)}
                </Badge>
              </div>
              {txn.description && (
                <p className="text-sm text-foreground mb-2">{txn.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${txn.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {txn.amount > 0 ? '+' : ''}{txn.amount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('billingTab.balanceAfter')}: {txn.balance_after}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('billing.invoices.date')}</TableHead>
                  <TableHead className="text-start">{t('billingTab.type')}</TableHead>
                  <TableHead className="text-start">{t('billingTab.description')}</TableHead>
                  <TableHead className="text-end">{t('billing.invoices.amount')}</TableHead>
                  <TableHead className="text-end">{t('billingTab.balanceAfter')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-start">{formatDate(txn.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={txn.amount > 0 ? 'default' : 'secondary'}>
                        {t(`billingTab.txnType.${txn.type}`, txn.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {txn.description || '—'}
                    </TableCell>
                    <TableCell className={`text-end font-medium ${txn.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {txn.balance_after}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
