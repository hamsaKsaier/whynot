/**
 * SessionForm — "Start New Exploration" card extracted from QALoopPage (5.1).
 * Owns the start-form UI: URL input, advanced options, login credentials, documents.
 */
import React from 'react';
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
  FiFolder,
  FiSettings,
} from 'react-icons/fi';
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
  isStarting, onStart,
}) => (
  <Card className="p-6 bg-slate-800 border-slate-700">
    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
      <FiPlay className="text-green-500" />
      Start New Scan
    </h2>

    <div className="space-y-4">
      {/* URL input — large and prominent */}
      <div>
        <Input
          id="target-url-input"
          type="url"
          placeholder="Enter your website URL — e.g. https://myapp.com"
          value={targetUrl}
          onChange={e => setTargetUrl(e.target.value)}
          className="w-full text-lg py-3 px-4"
        />
      </div>

      {/* Project selector — simple dropdown */}
      {projects && setSelectedProjectId && (
        <div>
          <select
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">
              {projects.length === 0
                ? 'Auto-create project from URL'
                : 'Auto-select most recent project'}
            </option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.website_url ? ` — ${p.website_url}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Environment selector (only if environments exist) */}
      {environments && environments.length > 0 && (
        <div>
          <select
            value=""
            onChange={e => {
              if (e.target.value) setTargetUrl(e.target.value);
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">Or pick a saved environment...</option>
            {environments.map(env => (
              <option key={env.id} value={env.url}>
                {env.name} — {env.url}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Use project context checkbox */}
      {setUseProjectContext && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-project-context"
            checked={useProjectContext ?? true}
            onChange={e => setUseProjectContext(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-0"
          />
          <label htmlFor="use-project-context" className="text-sm text-slate-300 cursor-pointer">
            Use project context (recommended)
          </label>
          {projectContextInfo && (
            <span className="text-xs text-sky-400 flex items-center gap-1 ml-auto">
              <FiInfo size={12} />
              {projectContextInfo}
            </span>
          )}
        </div>
      )}

      {/* Existing session prompt (Phase 3) */}
      {existingSession && (
        <div className="p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg">
          <div className="flex items-start gap-3">
            <FiRefreshCw className="text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-200">
                Previous run found for this URL
              </p>
              <p className="text-xs text-blue-400 mt-1">
                {existingSession.testCaseCount} test cases | {existingSession.bugsFound} bugs |{' '}
                Last run: {new Date(existingSession.completedAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setUseExisting(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    useExisting ? 'bg-blue-600 text-white' : 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60'
                  }`}
                >
                  Continue from last run
                </button>
                <button
                  type="button"
                  onClick={() => setUseExisting(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    !useExisting ? 'bg-blue-600 text-white' : 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60'
                  }`}
                >
                  Start fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Scan button — big, sky-blue, impossible to miss */}
      <Button
        onClick={onStart}
        disabled={isStarting || !targetUrl}
        className="w-full py-3 text-base font-semibold bg-sky-900/200 hover:bg-sky-600 text-white rounded-lg"
      >
        {isStarting ? (
          <span className="flex items-center justify-center gap-2">
            <FiActivity className="animate-spin" />
            Starting...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <FiPlay />
            Start Scan
          </span>
        )}
      </Button>

      {/* Advanced Options — collapsed accordion */}
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <FiSettings className="text-slate-500" size={14} />
          <span>Advanced Options</span>
          {showAdvanced ? <FiChevronUp className="ml-auto" /> : <FiChevronDown className="ml-auto" />}
        </button>

        {showAdvanced && (
          <div className="space-y-4 px-3 pb-3 pt-2 border-t border-slate-700">
            {/* Test Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                Test Priority
                <span className="group relative">
                  <FiInfo className="text-slate-500 cursor-help" size={14} />
                  <span className="invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg z-10 border border-slate-700">
                    <strong>Functional First:</strong> Explore functionality before security testing<br />
                    <strong>Balanced:</strong> Mix of exploration, security, and stability<br />
                    <strong>Security First:</strong> Start security testing earlier
                  </span>
                </span>
              </label>
              <select
                value={testPriority}
                onChange={e => setTestPriority(e.target.value as any)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="functional_first">Functional First (recommended)</option>
                <option value="balanced">Balanced</option>
                <option value="security_first">Security First</option>
              </select>
            </div>

            {/* Quality Threshold */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
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
              <label className="block text-sm font-medium text-slate-300 mb-1">
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

            {/* Login Credentials */}
            <div className="border border-slate-700 rounded-lg p-3">
              <button
                type="button"
                onClick={() => setUseLogin(!useLogin)}
                className="flex items-center gap-2 w-full text-left text-sm font-medium text-slate-300"
              >
                {useLogin
                  ? <FiToggleRight className="text-sky-500" size={20} />
                  : <FiToggleLeft className="text-slate-500" size={20} />
                }
                <FiLock className="text-slate-400" size={14} />
                Test Credentials (optional)
              </button>

              {useLogin && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-slate-400">
                    Use a test account only. Credentials are sent securely to the test runner.
                  </p>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email / Username</label>
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
                    <label className="block text-xs text-slate-400 mb-1">Password</label>
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
              <label className="block text-sm font-medium text-slate-300 mb-1">
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
              <label className="block text-sm font-medium text-slate-300 mb-2">
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
      </div>
    </div>
  </Card>
);
