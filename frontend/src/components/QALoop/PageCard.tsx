import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QALoopPage as QAPage } from '../../services/qa-loop-api';

function safePathname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).pathname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

export interface PageCardProps {
  page: QAPage;
}

export const PageCard: React.FC<PageCardProps> = ({ page }) => {
  const { t } = useTranslation('runner');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!page.url) return;
    try {
      await navigator.clipboard.writeText(page.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span
              className="shrink-0 mt-0.5"
              aria-label={
                page.is_explored
                  ? t('runner.qaLoop.results.pageExplored', 'Explored')
                  : t('runner.qaLoop.results.pagePending', 'Pending')
              }
            >
              {page.is_explored ? (
                <CheckCircle className="h-4 w-4 text-green-500" aria-hidden />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-foreground truncate">
                {page.title || safePathname(page.url, page.url)}
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate mt-0.5">
                {page.url}
              </div>
              {page.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                  {page.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {page.page_type && (
              <Badge variant="outline" className="text-muted-foreground text-[10px] sm:text-xs">
                {page.page_type}
              </Badge>
            )}
            {page.url && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleCopy}
                aria-label={t('runner.qaLoop.results.copyUrl', 'Copy URL')}
                title={t('runner.qaLoop.results.copyUrl', 'Copy URL')}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
