/**
 * SessionForm — "Start New Exploration" card extracted from QALoopPage (5.1).
 * Owns the start-form UI: URL input, advanced options, login credentials, documents.
 * Mobile: multi-step wizard (one step per screen). lg+: single form.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { DocumentUpload } from './DocumentUpload';
import {
  Play,
  Loader2,
  Lock,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
  Settings,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { QALoopSession, QALoopDocument, LoginCredentials } from '../../services/qa-loop-api';
import type { SavedEnvironment, ProjectWithStats } from '../../services/api';

export interface ExistingSessionInfo {
  id: string;
  testCaseCount: number;
  bugsFound: number;
  completedAt: string;
}

interface LoginCredsState {
  email: string;
  password: string;
  loginUrl: string;
  emailSelector: string;
  passwordSelector: string;
  submitSelector: string;
}

export interface SessionFormProps {
  // URL
  targetUrl: string;
  setTargetUrl: (v: string) => void;
  // Advanced options
  qualityThreshold: number;
  setQualityThreshold: (v: number) => void;
  maxIterations: number;
  setMaxIterations: (v: number) => void;
  documentContext: string;
  setDocumentContext: (v: string) => void;
  testPriority: 'functional_first' | 'balanced' | 'security_first';
  setTestPriority: (v: 'functional_first' | 'balanced' | 'security_first') => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  // Login credentials
  useLogin: boolean;
  setUseLogin: (v: boolean) => void;
  loginCredentials: LoginCredsState;
  setLoginCredentials: (updater: (prev: LoginCredsState) => LoginCredsState) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  // Existing session
  existingSession: ExistingSessionInfo | null;
  useExisting: boolean;
  setUseExisting: (v: boolean) => void;
  // Documents
  documents: QALoopDocument[];
  activeSession: QALoopSession | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  onToggle: (docId: string, isActive: boolean) => Promise<void>;
  // Projects (optional)
  projects?: ProjectWithStats[];
  selectedProjectId?: string;
  setSelectedProjectId?: (v: string) => void;
  // Environments (optional)
  environments?: SavedEnvironment[];
  // Project context
  useProjectContext?: boolean;
  setUseProjectContext?: (v: boolean) => void;
  projectContextInfo?: string | null;
  // Scan mode (v1 single agent vs v2 multi-agent)
  scanMode?: 'v1' | 'v2';
  setScanMode?: (v: 'v1' | 'v2') => void;
  // Submit
  isStarting: boolean;
  onStart: () => void;
}

export const SessionForm: React.FC<SessionFormProps> = ({
  targetUrl, setTargetUrl,
  qualityThreshold, setQualityThreshold,
  maxIterations, setMaxIterations,
  documentContext, setDocumentContext,
  testPriority, setTestPriority,
  showAdvanced, setShowAdvanced,
  useLogin, setUseLogin,
  loginCredentials, setLoginCredentials,
  showPassword, setShowPassword,
  existingSession, useExisting, setUseExisting,
  projects, selectedProjectId, setSelectedProjectId,
  environments,
  documents, activeSession, onUpload, onDelete, onToggle,
  useProjectContext, setUseProjectContext, projectContextInfo,
  scanMode, setScanMode,
  isStarting, onStart,
}) => {
  const { t } = useTranslation('runner');
  const [mobileStep, setMobileStep] = useState(0);
  const totalMobileSteps = 3;

  const stepUrlAndProject = (
    <>
      {/* URL input -- large and prominent */}
      <div>
        <Input
          id="target-url-input"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={t('runner.qaLoop.sessionForm.urlPlaceholder')}
          value={targetUrl}
          onChange={e => setTargetUrl(e.target.value)}
          className="text-sm sm:text-base py-2.5 sm:py-3 px-3 sm:px-4 h-10 sm:h-12"
        />
      </div>

      {/* Project selector */}
      {projects && setSelectedProjectId && (
        <div>
          <Select
            value={selectedProjectId || ''}
            onValueChange={v => setSelectedProjectId(v)}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  projects.length === 0
                    ? t('runner.qaLoop.sessionForm.autoCreateProject')
                    : t('runner.qaLoop.sessionForm.autoSelectProject')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.website_url ? ` -- ${p.website_url}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Environment selector (only if environments exist) */}
      {environments && environments.length > 0 && (
        <div>
          <Select
            value=""
            onValueChange={v => {
              if (v) setTargetUrl(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('runner.qaLoop.sessionForm.pickEnvironment')} />
            </SelectTrigger>
            <SelectContent>
              {environments.map(env => (
                <SelectItem key={env.id} value={env.url}>
                  {env.name} -- {env.url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Use project context checkbox */}
      {setUseProjectContext && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="use-project-context"
            checked={useProjectContext ?? true}
            onCheckedChange={checked => setUseProjectContext(checked === true)}
          />
          <Label htmlFor="use-project-context" className="cursor-pointer text-sm text-muted-foreground">
            {t('runner.qaLoop.sessionForm.useProjectContext')}
          </Label>
          {projectContextInfo && (
            <span className="text-xs text-primary flex items-center gap-1 ms-auto min-w-0">
              <Info className="h-3 w-3 shrink-0" />
              <span className="truncate">{projectContextInfo}</span>
            </span>
          )}
        </div>
      )}

      {/* Existing session prompt (Phase 3) */}
      {existingSession && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {t('runner.qaLoop.sessionForm.previousRunFound')}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {t('runner.qaLoop.sessionForm.previousRunStats', { testCases: existingSession.testCaseCount, bugs: existingSession.bugsFound, date: new Date(existingSession.completedAt).toLocaleDateString() })}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button
                  type="button"
                  variant={useExisting ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseExisting(true)}
                  className="text-xs flex-1 sm:flex-initial"
                >
                  {t('runner.qaLoop.sessionForm.continueFromLastRun')}
                </Button>
                <Button
                  type="button"
                  variant={!useExisting ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseExisting(false)}
                  className="text-xs flex-1 sm:flex-initial"
                >
                  {t('runner.qaLoop.sessionForm.startFresh')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const stepScanMode = (
    <>
      {/* Scan Mode Toggle -- v1 (Single Agent) vs v2 (QA Team) */}
      {setScanMode && (
        <div className="p-3 bg-muted/50 border border-border rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-sm text-muted-foreground">{t('runner.qaLoop.sessionForm.scanMode')}:</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scanMode !== 'v2' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setScanMode('v1')}
                className="text-xs"
              >
                {t('runner.qaLoop.sessionForm.singleAgent')}
              </Button>
              <Button
                type="button"
                variant={scanMode === 'v2' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setScanMode('v2')}
                className={cn('text-xs', scanMode === 'v2' && 'bg-purple-600 hover:bg-purple-700 text-primary-foreground')}
              >
                {t('runner.qaLoop.sessionForm.qaTeam')}
              </Button>
            </div>
          </div>
          {scanMode === 'v2' && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-purple-600 dark:text-purple-300">
                {t('runner.qaLoop.sessionForm.qaTeamDescription')}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t('runner.qaLoop.sessionForm.qaTeamPoweredBy')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Test Priority */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label>{t('runner.qaLoop.sessionForm.testPriority')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-64">
                <p className="text-xs">
                  <strong>{t('runner.qaLoop.sessionForm.functionalFirst')}:</strong> {t('runner.qaLoop.sessionForm.functionalFirstDesc')}<br />
                  <strong>{t('runner.qaLoop.sessionForm.balanced')}:</strong> {t('runner.qaLoop.sessionForm.balancedDesc')}<br />
                  <strong>{t('runner.qaLoop.sessionForm.securityFirst')}:</strong> {t('runner.qaLoop.sessionForm.securityFirstDesc')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={testPriority}
          onValueChange={v => setTestPriority(v as 'functional_first' | 'balanced' | 'security_first')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="functional_first">{t('runner.qaLoop.sessionForm.functionalFirstOption')}</SelectItem>
            <SelectItem value="balanced">{t('runner.qaLoop.sessionForm.balanced')}</SelectItem>
            <SelectItem value="security_first">{t('runner.qaLoop.sessionForm.securityFirst')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quality Threshold */}
      <div className="space-y-1.5">
        <Label>{t('runner.qaLoop.sessionForm.qualityThreshold', { value: qualityThreshold })}</Label>
        <Slider
          min={50}
          max={100}
          step={1}
          value={[qualityThreshold]}
          onValueChange={v => setQualityThreshold(v[0])}
        />
      </div>

      {/* Max Iterations */}
      <div className="space-y-1.5">
        <Label>{t('runner.qaLoop.sessionForm.maxIterations')}</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          value={maxIterations}
          onChange={e => setMaxIterations(Number(e.target.value))}
        />
      </div>
    </>
  );

  const stepAdvanced = (
    <>
      {/* Login Credentials */}
      <div className="border border-border rounded-lg p-3">
        <div className="flex items-center justify-between min-h-[44px]">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="use-login-switch" className="cursor-pointer">
              {t('runner.qaLoop.sessionForm.testCredentials')}
            </Label>
          </div>
          <Switch
            id="use-login-switch"
            checked={useLogin}
            onCheckedChange={setUseLogin}
          />
        </div>

        {useLogin && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('runner.qaLoop.sessionForm.credentialsHint')}
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('runner.qaLoop.sessionForm.emailUsername')}</Label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="test@example.com"
                  value={loginCredentials.email}
                  onChange={e => setLoginCredentials(prev => ({ ...prev, email: e.target.value }))}
                  className="ps-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('runner.qaLoop.sessionForm.password')}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginCredentials.password}
                  onChange={e => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="ps-9 pe-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('runner.qaLoop.sessionForm.loginUrl')}</Label>
              <Input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder={t('runner.qaLoop.sessionForm.loginUrlPlaceholder')}
                value={loginCredentials.loginUrl}
                onChange={e => setLoginCredentials(prev => ({ ...prev, loginUrl: e.target.value }))}
              />
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="selectors" className="border-none">
                <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:text-foreground hover:no-underline">
                  {t('runner.qaLoop.sessionForm.customSelectors')}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-1">
                    <Input
                      type="text"
                      placeholder={t('runner.qaLoop.sessionForm.emailSelectorPlaceholder')}
                      value={loginCredentials.emailSelector}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, emailSelector: e.target.value }))}
                      className="text-xs h-8"
                    />
                    <Input
                      type="text"
                      placeholder={t('runner.qaLoop.sessionForm.passwordSelectorPlaceholder')}
                      value={loginCredentials.passwordSelector}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, passwordSelector: e.target.value }))}
                      className="text-xs h-8"
                    />
                    <Input
                      type="text"
                      placeholder={t('runner.qaLoop.sessionForm.submitSelectorPlaceholder')}
                      value={loginCredentials.submitSelector}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, submitSelector: e.target.value }))}
                      className="text-xs h-8"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>

      {/* Quick context paste */}
      <div className="space-y-1.5">
        <Label>{t('runner.qaLoop.sessionForm.quickContext')}</Label>
        <Textarea
          placeholder={t('runner.qaLoop.sessionForm.quickContextPlaceholder')}
          value={documentContext}
          onChange={e => setDocumentContext(e.target.value)}
          rows={4}
        />
      </div>

      {/* Document upload */}
      <div className="space-y-1.5">
        <Label>{t('runner.qaLoop.sessionForm.documentsLabel')}</Label>
        <DocumentUpload
          sessionId={activeSession?.id}
          documents={documents as any}
          onUpload={onUpload}
          onDelete={onDelete}
          onToggle={onToggle}
          disabled={!activeSession}
        />
        {!activeSession && (
          <p className="text-xs text-muted-foreground mt-1">{t('runner.qaLoop.sessionForm.startSessionToUpload')}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {t('runner.qaLoop.sessionForm.documentsHint')}
        </p>
      </div>
    </>
  );

  const mobileStepLabels = [
    t('runner.qaLoop.sessionForm.stepTarget', { defaultValue: 'Target' }),
    t('runner.qaLoop.sessionForm.stepConfig', { defaultValue: 'Config' }),
    t('runner.qaLoop.sessionForm.stepAdvanced', { defaultValue: 'Advanced' }),
  ];

  const mobileStepContent = [stepUrlAndProject, stepScanMode, stepAdvanced];

  return (
  <Card>
    <CardContent className="p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
        <Play className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />
        {t('runner.qaLoop.sessionForm.startNewScan')}
      </h2>

      {/* ── Desktop: all sections visible ── */}
      <div className="hidden lg:block space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            {stepUrlAndProject}
          </div>
          <div className="space-y-4">
            {stepScanMode}
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          value={showAdvanced ? 'advanced' : ''}
          onValueChange={v => setShowAdvanced(v === 'advanced')}
        >
          <AccordionItem value="advanced" className="border rounded-lg">
            <AccordionTrigger className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:no-underline">
              <span className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" />
                {t('runner.qaLoop.sessionForm.advancedOptions')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="space-y-4 pt-2">
                {stepAdvanced}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Start Scan button */}
        <Button
          onClick={onStart}
          disabled={isStarting || !targetUrl}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {isStarting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('runner.qaLoop.sessionForm.starting')}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Play className="h-4 w-4" />
              {t('runner.qaLoop.sessionForm.startScan')}
            </span>
          )}
        </Button>
      </div>

      {/* ── Mobile: multi-step wizard ── */}
      <div className="lg:hidden space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-1" role="tablist" aria-label={t('runner.qaLoop.sessionForm.wizardSteps', { defaultValue: 'Form steps' })}>
          {mobileStepLabels.map((label, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === mobileStep}
              onClick={() => setMobileStep(i)}
              className={cn(
                'flex-1 text-center py-2 text-xs font-medium rounded-md transition-colors duration-150',
                i === mobileStep
                  ? 'bg-primary text-primary-foreground'
                  : i < mobileStep
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-3">
          {mobileStepContent[mobileStep]}
        </div>

        {/* Navigation + start */}
        <div className="flex items-center gap-2">
          {mobileStep > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => setMobileStep(mobileStep - 1)}
            >
              <ChevronLeft className="h-4 w-4 me-1 rtl:scale-x-[-1]" />
              {t('common.back', { defaultValue: 'Back' })}
            </Button>
          )}
          {mobileStep < totalMobileSteps - 1 ? (
            <Button
              type="button"
              variant="default"
              className="flex-1 min-h-[44px]"
              onClick={() => setMobileStep(mobileStep + 1)}
              disabled={mobileStep === 0 && !targetUrl}
            >
              {t('common.next', { defaultValue: 'Next' })}
              <ChevronRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
            </Button>
          ) : (
            <Button
              onClick={onStart}
              disabled={isStarting || !targetUrl}
              className="flex-1 min-h-[44px] text-base font-semibold"
              size="lg"
            >
              {isStarting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('runner.qaLoop.sessionForm.starting')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Play className="h-4 w-4" />
                  {t('runner.qaLoop.sessionForm.startScan')}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
  );
};
