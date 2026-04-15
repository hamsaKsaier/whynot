/**
 * SessionList — "Recent Sessions" card extracted from QALoopPage (5.1).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { QALoopSession } from '../../services/qa-loop-api';

function safeHostname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).hostname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running':   return 'default';
    case 'completed': return 'default';
    case 'failed':    return 'destructive';
    default:          return 'secondary';
  }
}

function getStatusClassName(status: string): string {
  switch (status) {
    case 'running':   return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'completed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'paused':    return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'failed':    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'cancelled': return 'bg-muted text-muted-foreground';
    default:          return 'bg-muted text-muted-foreground';
  }
}

export interface SessionListProps {
  sessions: QALoopSession[];
  activeSession: QALoopSession | null;
  isLoading: boolean;
  onSelect: (session: QALoopSession) => void;
  /** 6.6 -- pagination */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  activeSession,
  isLoading,
  onSelect,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) => {
  const { t } = useTranslation('runner');

  return (
  <Card>
    <CardContent className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        {t('runner.qaLoop.sessions.title')}
      </h2>

      {isLoading ? (
        <div className="space-y-3 py-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{t('runner.qaLoop.sessions.empty')}</p>
          <Button
            variant="link"
            className="text-sm"
            onClick={() => {
              const el = document.getElementById('target-url-input');
              el?.focus();
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            {t('runner.qaLoop.sessions.startFirst')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session)}
              className={cn(
                'w-full text-start p-3 rounded-lg border transition-colors duration-150',
                activeSession?.id === session.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground truncate">
                  {safeHostname(session.target_url, session.target_url)}
                </span>
                <Badge
                  variant="outline"
                  className={cn('text-xs', getStatusClassName(session.status))}
                >
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span>{t('runner.qaLoop.sessions.pages', { count: session.pages_explored })}</span>
                <span>{t('runner.qaLoop.sessions.tests', { count: session.tests_generated })}</span>
                <span>{t('runner.qaLoop.sessions.bugs', { count: session.bugs_found })}</span>
              </div>
            </button>
          ))}

          {/* 6.6 -- Load more */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="w-full mt-1"
            >
              {isLoadingMore ? t('runner.qaLoop.sessions.loading') : t('runner.qaLoop.sessions.loadMore')}
            </Button>
          )}
        </div>
      )}
    </CardContent>
  </Card>
  );
};
