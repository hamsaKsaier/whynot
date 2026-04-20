import React from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { QALoopTestCase } from '../../services/qa-loop-api';

const categoryColor = (c: string | undefined | null): string => {
  switch ((c || '').toLowerCase()) {
    case 'functional':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'visual':
    case 'ui':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'a11y':
    case 'accessibility':
      return 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300 border-teal-200 dark:border-teal-800';
    case 'performance':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'security':
      return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const priorityClass = (p: number | undefined | null): string => {
  const n = Number(p ?? 0);
  if (n >= 80) return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800';
  if (n >= 50) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  return 'bg-muted text-muted-foreground border-border';
};

const statusIcon = (s: string | null | undefined) => {
  if (s === 'passed' || s === 'confirmed') return <CheckCircle className="h-4 w-4 text-green-500" aria-hidden />;
  if (s === 'failed' || s === 'error') return <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />;
  if (s === 'mismatch') return <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />;
  return <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />;
};

export interface TestCardProps {
  test: QALoopTestCase;
  statusLabel: (s: string | null) => string;
  statusColor: (s: string | null) => string;
}

export const TestCard: React.FC<TestCardProps> = ({ test, statusLabel, statusColor }) => {
  const { t } = useTranslation('runner');
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="shrink-0 mt-0.5">{statusIcon(test.last_run_status)}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-foreground break-words">
                {test.name}
              </div>
              {test.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">
                  {test.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 shrink-0 ms-6 sm:ms-0">
            {test.category && (
              <Badge
                variant="outline"
                className={cn('text-[10px] sm:text-xs', categoryColor(test.category))}
              >
                {test.category}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn('text-[10px] sm:text-xs tabular-nums', priorityClass(test.priority))}
              title={t('runner.qaLoop.results.priorityTooltip', 'Priority score (0-100)')}
            >
              <span className="hidden sm:inline">Priority&nbsp;</span>
              <span className="sm:hidden">P</span>
              {test.priority ?? 0}
            </Badge>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2 ms-6 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <ListOrdered className="h-3 w-3" aria-hidden />
            {t('runner.qaLoop.results.stepsCount', { count: test.steps?.length || 0 })}
          </span>
          {test.last_run_status && (
            <span className={cn('inline-flex items-center gap-1', statusColor(test.last_run_status))}>
              {t('runner.qaLoop.results.lastStatus', { status: statusLabel(test.last_run_status) })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
