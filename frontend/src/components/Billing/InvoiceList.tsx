import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { ExternalLink, Download } from 'lucide-react';

interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  paid: 'default',
  open: 'secondary',
};

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices }) => {
  const { t, i18n } = useTranslation('billing');

  const formatCurrency = (cents: number, currency = 'USD') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t('billing.invoices.empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: card stack */}
      <div className="space-y-3 md:hidden">
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</span>
                <Badge variant={STATUS_VARIANTS[inv.status] || 'outline'}>
                  {inv.status}
                </Badge>
              </div>
              {inv.period_start && inv.period_end && (
                <p className="text-xs text-muted-foreground mb-2">
                  {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(inv.amount_cents, inv.currency)}
                </span>
                <div className="flex items-center gap-1">
                  {inv.invoice_pdf && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {inv.invoice_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 rtl:scale-x-[-1]" />
                      </a>
                    </Button>
                  )}
                </div>
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
                  <TableHead className="text-start">{t('billingTab.invoicePeriod')}</TableHead>
                  <TableHead className="text-end">{t('billing.invoices.amount')}</TableHead>
                  <TableHead className="text-start">{t('billing.invoices.status')}</TableHead>
                  <TableHead className="text-end">{t('billingTab.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-start">{formatDate(inv.created_at)}</TableCell>
                    <TableCell className="text-start text-muted-foreground">
                      {inv.period_start && inv.period_end
                        ? `${formatDate(inv.period_start)} – ${formatDate(inv.period_end)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatCurrency(inv.amount_cents, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[inv.status] || 'outline'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        {inv.invoice_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 rtl:scale-x-[-1]" />
                            </a>
                          </Button>
                        )}
                        {inv.invoice_pdf && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
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
