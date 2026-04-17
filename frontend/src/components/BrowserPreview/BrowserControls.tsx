import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Home,
  ZoomIn,
  ZoomOut,
  Settings,
  Moon,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface BrowserControlsProps {
  url?: string;
  onNavigate?: (direction: 'back' | 'forward' | 'refresh' | 'home') => void;
  onZoomChange?: (zoom: number) => void;
  onBrowserChange?: (browser: string) => void;
  onResolutionChange?: (resolution: string) => void;
  currentZoom?: number;
  currentBrowser?: string;
  currentResolution?: string;
}

const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const resolutions = ['1920x1080', '1366x768', '1536x864', '1440x900', '1280x720'];

export const BrowserControls: React.FC<BrowserControlsProps> = ({
  url = '',
  onNavigate,
  onZoomChange,
  onBrowserChange,
  onResolutionChange,
  currentBrowser = 'Chrome',
  currentResolution = '1920x1080',
  currentZoom = 100,
}) => {
  const { t } = useTranslation('runner');
  const [showSettings, setShowSettings] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-card border-b border-border">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
          {/* Navigation Controls */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate?.('back')} aria-label={t('runner.browser.back', 'Back')}>
                  <ChevronLeft className="h-4 w-4 rtl:scale-x-[-1]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.back')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate?.('forward')} aria-label={t('runner.browser.forward', 'Forward')}>
                  <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.forward')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate?.('refresh')} aria-label={t('runner.browser.refresh', 'Refresh')}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.refresh')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate?.('home')} aria-label={t('runner.browser.home', 'Home')}>
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.home')}</TooltipContent>
            </Tooltip>
          </div>

          {/* URL Bar */}
          <div className="flex-1 mx-3">
            <div className="bg-muted border border-border rounded-md px-3 py-1.5 flex items-center">
              <span className="flex-1 text-sm text-foreground truncate">
                {url || 'about:blank'}
              </span>
              {url && (
                <Badge variant="outline" className="ms-2 text-[10px] px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                  {t('runner.browser.secure')}
                </Badge>
              )}
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground tabular-nums">{currentZoom}%</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onZoomChange?.(Math.max(25, currentZoom - 25))} aria-label={t('runner.browser.zoomOut', 'Zoom out')}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.zoomOut')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onZoomChange?.(Math.min(200, currentZoom + 25))} aria-label={t('runner.browser.zoomIn', 'Zoom in')}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.zoomIn')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Browser Settings Bar */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{t('runner.browser.browser')}:</Label>
              <Select value={currentBrowser} onValueChange={(v) => onBrowserChange?.(v)}>
                <SelectTrigger className="h-7 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {browsers.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-4" />

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{t('runner.browser.resolution')}:</Label>
              <Select value={currentResolution} onValueChange={(v) => onResolutionChange?.(v)}>
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutions.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Moon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.darkMode')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Camera className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('runner.browser.screenshot')}</TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-3 w-3" />
              {t('runner.browser.advanced')}
            </Button>
          </div>
        </div>

        {/* Advanced Settings Panel */}
        {showSettings && (
          <div className="px-3 py-2.5 bg-muted/50 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('runner.browser.location')}:</Label>
                <Select defaultValue="london">
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london" className="text-xs">London, UK</SelectItem>
                    <SelectItem value="newyork" className="text-xs">New York, US</SelectItem>
                    <SelectItem value="tokyo" className="text-xs">Tokyo, Japan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('runner.browser.network')}:</Label>
                <Select defaultValue="none">
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">{t('runner.browser.noThrottling')}</SelectItem>
                    <SelectItem value="3g" className="text-xs">3G</SelectItem>
                    <SelectItem value="4g" className="text-xs">4G</SelectItem>
                    <SelectItem value="wifi" className="text-xs">WiFi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
