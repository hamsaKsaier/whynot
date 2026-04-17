import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BrowserFrameProps {
  imageUrl?: string;
  isLoading?: boolean;
  error?: string;
  url?: string;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  imageUrl,
  isLoading = false,
  error,
  url,
}) => {
  const { t } = useTranslation('common');
  return (
    <div className="flex-1 bg-muted/30 flex items-center justify-center overflow-auto p-4">
      {isLoading && !imageUrl && (
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">{t('browserFrame.connecting', 'Connecting to browser stream...')}</p>
          {url && (
            <p className="text-xs text-muted-foreground/70">{t('browserFrame.urlLabel', 'URL')}: {url}</p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">{error}</p>
            <p className="text-xs mt-2 opacity-80">
              {t('browserFrame.errorHint', 'Check browser console for more details. Make sure WebSocket server is running.')}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && imageUrl && (
        <div className="relative max-w-full">
          <img
            src={imageUrl}
            alt={t('browserFrame.previewAlt', 'Browser preview')}
            className="max-w-full h-auto rounded-lg border border-border"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && !imageUrl && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Globe className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {t('browserFrame.waiting', 'Waiting for browser frames...')}
          </p>
          {url && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('browserFrame.urlLabel', 'URL')}: {url}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t('browserFrame.waitingHint', 'Frames will appear here once WebSocket connection is established and test execution begins')}
          </p>
        </div>
      )}
    </div>
  );
};
