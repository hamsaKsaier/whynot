import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Video,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { QALoopBug } from '../../services/qa-loop-api';
import { CreateTaskButton } from './CreateTaskButton';
import { AutoFixButton } from './AutoFixButton';

export interface BugCardProps {
  bug: QALoopBug;
  severityColor: (s: string) => string;
  safePathname: (url: string | undefined | null, fallback?: string) => string;
}

/** Expandable bug card with reproduction steps and action buttons */
export const BugCard: React.FC<BugCardProps> = ({ bug, severityColor, safePathname }) => {
  const { t } = useTranslation('runner');
  const [expanded, setExpanded] = useState(false);

  const reproSteps = Array.isArray(bug.reproduction_steps) ? bug.reproduction_steps : [];

  return (
    <Card className="overflow-hidden border-s-4 border-s-red-400 dark:border-s-red-500 shadow-sm">
      <div
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          {/* Title + chevron + inline severity */}
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <ChevronRight
              className={cn(
                'h-4 w-4 mt-0.5 text-muted-foreground transition-transform duration-150 rtl:scale-x-[-1] shrink-0',
                expanded && 'rotate-90'
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground break-words">
                  {bug.title}
                </span>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] sm:text-xs shrink-0', severityColor(bug.severity))}
                >
                  {bug.severity}
                </Badge>
              </div>
              {bug.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                  {bug.description}
                </p>
              )}
            </div>
          </div>

          {/* Actions + status */}
          <div
            className="flex items-center gap-1.5 shrink-0 ms-6 sm:ms-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Status badge: visible on all widths */}
            {bug.status === 'confirmed' ? (
              <Badge
                variant="outline"
                className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 text-[10px] sm:text-xs"
              >
                <CheckCircle className="h-3 w-3" aria-hidden />
                {t('runner.qaLoop.bugs.verified')}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 text-[10px] sm:text-xs"
              >
                <AlertCircle className="h-3 w-3" aria-hidden />
                {t('runner.qaLoop.bugs.aiObserved')}
              </Badge>
            )}

            {/* Actions wrap naturally on mobile */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <AutoFixButton bugId={bug.id} bugTitle={bug.title} />
              <CreateTaskButton bugId={bug.id} bugTitle={bug.title} />
            </div>
          </div>
        </div>

        {/* Meta row: category / bug type / url / video */}
        <div className="text-xs text-muted-foreground mt-2 ms-6 flex items-center flex-wrap gap-x-3 gap-y-1">
          {bug.category && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {bug.category}
            </Badge>
          )}
          {bug.bug_type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {bug.bug_type}
            </Badge>
          )}
          {bug.page_url && (
            <span className="truncate max-w-[12rem] font-mono" title={bug.page_url}>
              {safePathname(bug.page_url)}
            </span>
          )}
          {bug.status && (
            <span
              className={cn(
                bug.status === 'open'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-green-500 dark:text-green-400'
              )}
            >
              {bug.status}
            </span>
          )}
          {bug.video_path && (
            <span
              className="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400"
              title={t('runner.qaLoop.bugs.sessionRecording')}
            >
              <Video className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">
                {t('runner.qaLoop.bugs.recording', 'Recording')}
              </span>
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 ms-6 space-y-3">
          <Separator />
          {reproSteps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {t('runner.qaLoop.bugs.reproductionSteps')}
              </div>
              <ol className="list-decimal list-inside space-y-1">
                {reproSteps.map((step: any, i: number) => (
                  <li key={i} className="text-sm text-foreground">
                    {typeof step === 'string'
                      ? step
                      : step.description || step.action || JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {bug.page_url && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {t('runner.qaLoop.bugs.pageUrl')}
              </div>
              <a
                href={bug.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 break-all"
              >
                {bug.page_url}
              </a>
            </div>
          )}

          {bug.video_path && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {t('runner.qaLoop.bugs.sessionRecording')}
              </div>
              <video
                controls
                preload="metadata"
                className="w-full rounded-lg max-h-64 bg-black"
                src={`/api/videos/${bug.video_path}`}
              >
                {t('runner.qaLoop.bugs.videoNotSupported')}
              </video>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
