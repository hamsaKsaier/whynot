/**
 * SessionForm — "Start New Exploration" card extracted from QALoopPage (5.1).
 * Owns the start-form UI: URL input, advanced options, login credentials, documents.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Card }     from '../common/Card';
import { Button }   from '../common/Button';
import { Input }    from '../common/Input';
import { Textarea } from '../common/Textarea';
import { DocumentUpload } from './DocumentUpload';
import {
  FiPlay,
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiLock,
  FiUser,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiToggleLeft,
  FiToggleRight,
  FiInfo,
  FiAlertCircle,
} from 'react-icons/fi';
import { QALoopSession, QALoopDocument, LoginCredentials } from '../../services/qa-loop-api';
import { getBillingCredits } from '../../services/api';
import type { SavedEnvironment } from '../../services/api';

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
  // Environments (optional)
  environments?: SavedEnvironment[];
  // Submit
  isStarting: boolean;
  onStart: () => void;
}

/** Estimate credits based on URL complexity heuristic */
function estimateCreditCost(url: string): { estimate: string; range: [number, number] } {
  if (!url) return { estimate: '~10-20', range: [10, 20] };
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    // Large app indicators: paths like /app, /dashboard, /admin, deep nesting
    const hasAppPaths = /\/(app|dashboard|admin|portal|console)\b/.test(path);
    const pathDepth = path.split('/').filter(Boolean).length;
    if (hasAppPaths || pathDepth >= 3) return { estimate: '~25-30', range: [25, 30] };
    if (pathDepth >= 1 && pathDepth < 3) return { estimate: '~10-20', range: [10, 20] };
    // Simple single-page or root URL
    return { estimate: '~5-10', range: [5, 10] };
  } catch {
    return { estimate: '~10-20', range: [10, 20] };
  }
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
  environments,
  documents, activeSession, onUpload, onDelete, onToggle,
  isStarting, onStart,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

  // Fetch credit balance when form is first shown
  useEffect(() => {
    getBillingCredits()
      .then((data: any) => setCreditsRemaining(data?.balance?.balance ?? data?.balance ?? null))
      .catch(() => setCreditsRemaining(null));
  }, []);

  const costEstimate = useMemo(() => estimateCreditCost(targetUrl), [targetUrl]);

  const handleStartClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmStart = () => {
    setShowConfirm(false);
    onStart();
  };

  return (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
      <FiPlay className="text-green-500" />
      Start New Exploration
    </h2>

    <div className="space-y-4">
      {/* Environment selector + Target URL */}
      <div>
        {environments && environments.length > 0 && (
          <div className="mb-2">
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Environment
            </label>
            <select
              value=""
              onChange={e => {
                if (e.target.value) setTargetUrl(e.target.value);
              }}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select an environment or type URL below</option>
              {environments.map(env => (
                <option key={env.id} value={env.url}>
                  {env.name} — {env.url}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="block text-sm font-medium text-slate-200 mb-1">
          Target URL
        </label>
        <Input
          id="target-url-input"
          type="url"
          placeholder="https://example.com"
          value={targetUrl}
          onChange={e => setTargetUrl(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Existing session prompt (Phase 3) */}
      {existingSession && (
        <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <FiRefreshCw className="text-blue-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Previous run found for this URL
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {existingSession.testCaseCount} test cases | {existingSession.bugsFound} bugs |{' '}
                Last run: {new Date(existingSession.completedAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setUseExisting(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    useExisting ? 'bg-blue-600 text-white' : 'bg-blue-900/30 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  Continue from last run
                </button>
                <button
                  type="button"
                  onClick={() => setUseExisting(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    !useExisting ? 'bg-blue-600 text-white' : 'bg-blue-900/30 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  Start fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        {showAdvanced ? <FiChevronUp /> : <FiChevronDown />}
        Advanced Options
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-slate-700">
          {/* Test Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1 flex items-center gap-2">
              Test Priority
              <span className="group relative">
                <FiInfo className="text-slate-500 cursor-help" size={14} />
                <span className="invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg z-10">
                  <strong>Functional First:</strong> Explore functionality before security testing<br />
                  <strong>Balanced:</strong> Mix of exploration, security, and stability<br />
                  <strong>Security First:</strong> Start security testing earlier
                </span>
              </span>
            </label>
            <select
              value={testPriority}
              onChange={e => setTestPriority(e.target.value as any)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="functional_first">Functional First (recommended)</option>
              <option value="balanced">Balanced</option>
              <option value="security_first">Security First</option>
            </select>
          </div>

          {/* Quality Threshold */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Quality Threshold (%)
            </label>
            <Input
              type="number"
              min={50}
              max={100}
              value={qualityThreshold}
              onChange={e => setQualityThreshold(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Max Iterations */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Max Iterations
            </label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={maxIterations}
              onChange={e => setMaxIterations(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Authentication Credentials */}
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setUseLogin(!useLogin)}
              className="flex items-center gap-2 w-full text-left text-sm font-medium text-slate-200 p-3 hover:bg-slate-900 transition-colors"
            >
              {useLogin
                ? <FiChevronUp className="text-slate-500" size={16} />
                : <FiChevronDown className="text-slate-500" size={16} />
              }
              <FiLock className="text-slate-400" size={14} />
              Authentication
              <span className="text-xs text-slate-500 font-normal ml-auto">Optional</span>
            </button>

            {useLogin && (
              <div className="px-3 pb-3 space-y-3 border-t border-slate-700 pt-3">
                <div className="flex items-start gap-2 p-2 bg-amber-900/20 border border-amber-700 rounded text-xs text-amber-800">
                  <FiInfo className="shrink-0 mt-0.5" size={13} />
                  <span>Credentials are encrypted and used only for automated testing</span>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Test Username</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={14} />
                    <Input
                      type="text"
                      placeholder="test@example.com"
                      value={loginCredentials.email}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Test Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={14} />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginCredentials.password}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-400"
                    >
                      {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Login URL (optional)</label>
                  <Input
                    type="text"
                    placeholder="Leave empty to use target URL"
                    value={loginCredentials.loginUrl}
                    onChange={e => setLoginCredentials(prev => ({ ...prev, loginUrl: e.target.value }))}
                    className="w-full text-sm"
                  />
                </div>

                <details className="text-xs">
                  <summary className="text-slate-400 cursor-pointer hover:text-slate-200">
                    Custom selectors (advanced)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Input
                      type="text"
                      placeholder="Email selector (e.g., input[name='email'])"
                      value={loginCredentials.emailSelector}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, emailSelector: e.target.value }))}
                      className="w-full text-xs"
                    />
                    <Input
                      type="text"
                      placeholder="Password selector"
                      value={loginCredentials.passwordSelector}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, passwordSelector: e.target.value }))}
                      className="w-full text-xs"
                    />
                    <Input
                      type="text"
                      placeholder="Submit button selector"
                      value={loginCredentials.submitSelector}
                      onChange={e => setLoginCredentials(prev => ({ ...prev, submitSelector: e.target.value }))}
                      className="w-full text-xs"
                    />
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Quick context paste */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Quick Context (paste)
            </label>
            <Textarea
              placeholder="Paste API docs, user stories, or business rules here..."
              value={documentContext}
              onChange={e => setDocumentContext(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>

          {/* Document upload */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Documents (upload files)
            </label>
            <DocumentUpload
              sessionId={activeSession?.id}
              documents={documents as any}
              onUpload={onUpload}
              onDelete={onDelete}
              onToggle={onToggle}
              disabled={!activeSession}
            />
            {!activeSession && (
              <p className="text-xs text-slate-400 mt-1">Start a session to upload documents</p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Upload PRDs, specs, or documentation to help the AI understand your application.
            </p>
          </div>
        </div>
      )}

      {/* Credit estimate */}
      {targetUrl && !showConfirm && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg">
          <FiInfo className="text-sky-400 shrink-0" size={14} />
          <span className="text-sm text-slate-300">
            Estimated cost: <span className="font-semibold text-white">{costEstimate.estimate} credits</span>
          </span>
          <span className="text-xs text-slate-500 ml-auto">Actual cost depends on site complexity</span>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <FiAlertCircle className="text-sky-400 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                This scan will use approximately {costEstimate.estimate} credits.
              </p>
              {creditsRemaining !== null && (
                <p className="text-sm text-slate-400">
                  You have <span className={`font-semibold ${creditsRemaining < costEstimate.range[1] ? 'text-red-400' : 'text-emerald-400'}`}>
                    {creditsRemaining} credits
                  </span> remaining.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleConfirmStart}
              disabled={isStarting}
              className="flex-1"
            >
              {isStarting ? (
                <span className="flex items-center gap-2">
                  <FiActivity className="animate-spin" />
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FiPlay />
                  Start Scan
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowConfirm(false)}
              disabled={isStarting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Start button (shown when not in confirmation state) */}
      {!showConfirm && (
        <Button
          onClick={handleStartClick}
          disabled={isStarting || !targetUrl}
          className="w-full"
        >
          {isStarting ? (
            <span className="flex items-center gap-2">
              <FiActivity className="animate-spin" />
              Starting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <FiPlay />
              Start Exploration
            </span>
          )}
        </Button>
      )}
    </div>
  </Card>
  );
};
