import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ChevronRight, CheckCircle, AlertCircle, Video } from 'lucide-react';
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
    <Card className="overflow-hidden border-s-4 border-s-red-400 dark:border-s-red-500">
      <div
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                'h-3 w-3 text-muted-foreground transition-transform duration-150 rtl:scale-x-[-1]',
                expanded && 'rotate-90'
              )}
            />
            <span className="font-medium text-foreground">{bug.title}</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <AutoFixButton bugId={bug.id} bugTitle={bug.title} />
            <CreateTaskButton bugId={bug.id} bugTitle={bug.title} />
            {bug.status === 'confirmed' ? (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                <CheckCircle className="h-3 w-3" />
                {t('runner.qaLoop.bugs.verified')}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                <AlertCircle className="h-3 w-3" />
                {t('runner.qaLoop.bugs.aiObserved')}
              </Badge>
            )}
            <Badge variant="outline" className={severityColor(bug.severity)}>
              {bug.severity}
            </Badge>
          </div>
        </div>
        {bug.description && <p className="text-sm text-muted-foreground mt-1 ms-5">{bug.description}</p>}
        <div className="text-xs text-muted-foreground mt-2 ms-5 flex items-center gap-3">
          {bug.category && <Badge variant="secondary" className="text-xs px-1.5 py-0">{bug.category}</Badge>}
          {bug.bug_type && <Badge variant="secondary" className="text-xs px-1.5 py-0">{bug.bug_type}</Badge>}
          {bug.page_url && <span className="truncate max-w-xs">{safePathname(bug.page_url)}</span>}
          <span className={bug.status === 'open' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}>{bug.status}</span>
          {bug.video_path && (
            <span className="text-blue-500 dark:text-blue-400 flex items-center gap-0.5" title="Video recording available">
              <Video className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 ms-5 space-y-3">
          <Separator />
          {reproSteps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{t('runner.qaLoop.bugs.reproductionSteps')}</div>
              <ol className="list-decimal list-inside space-y-1">
                {reproSteps.map((step: any, i: number) => (
                  <li key={i} className="text-sm text-foreground">
                    {typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {bug.page_url && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{t('runner.qaLoop.bugs.pageUrl')}</div>
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
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{t('runner.qaLoop.bugs.sessionRecording')}</div>
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
