import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2, FiPlay, FiSave, FiBookmark } from 'react-icons/fi';
import type { PerfRunConfig } from '../../services/perf-api';

// ── Saved configs in localStorage ──────────────────────────────────────────
interface SavedConfig {
  name: string;
  targetUrl: string;
  method: string;
  headers: Array<{ key: string; value: string }>;
  requestBody: string;
  testType: string;
}

const SAVED_CONFIGS_KEY = 'whynot_perf_saved_configs';

function loadSavedConfigs(): SavedConfig[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_CONFIGS_KEY) || '[]');
  } catch { return []; }
}

function saveSavedConfigs(configs: SavedConfig[]) {
  localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(configs));
}

interface TestConfigProps {
  onRun: (config: PerfRunConfig) => void;
  isRunning: boolean;
  projectId?: string;
}

type TestType = 'smoke' | 'load' | 'stress' | 'spike';

const TEST_TYPE_VUS: Record<TestType, { vus: string; duration: string }> = {
  smoke: { vus: '1', duration: '30s' },
  load: { vus: '50', duration: '9m' },
  stress: { vus: '150', duration: '17m' },
  spike: { vus: '200', duration: '5m' },
};

interface HeaderEntry {
  key: string;
  value: string;
}

interface AdditionalRequest {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export const TestConfig: React.FC<TestConfigProps> = ({ onRun, isRunning, projectId }) => {
  const { t } = useTranslation('runner');
  const [testType, setTestType] = useState<TestType>('load');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState<HeaderEntry[]>([
    { key: 'Content-Type', value: 'application/json' },
  ]);
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [vus, setVus] = useState(TEST_TYPE_VUS.load.vus);
  const [duration, setDuration] = useState(TEST_TYPE_VUS.load.duration);
  const [additionalRequests, setAdditionalRequests] = useState<AdditionalRequest[]>([]);
  const [expectedStatus, setExpectedStatus] = useState('200');
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => { setSavedConfigs(loadSavedConfigs()); }, []);

  const handleSaveConfig = () => {
    if (!saveName.trim() || !targetUrl.trim()) return;
    const config: SavedConfig = { name: saveName.trim(), targetUrl, method, headers, requestBody, testType };
    const updated = [...savedConfigs.filter(c => c.name !== config.name), config];
    saveSavedConfigs(updated);
    setSavedConfigs(updated);
    setShowSaveInput(false);
    setSaveName('');
  };

  const handleLoadConfig = (config: SavedConfig) => {
    setTargetUrl(config.targetUrl);
    setMethod(config.method);
    setHeaders(config.headers);
    setRequestBody(config.requestBody);
    handleTestTypeChange(config.testType as TestType);
    setShowSaved(false);
  };

  const handleDeleteConfig = (name: string) => {
    const updated = savedConfigs.filter(c => c.name !== name);
    saveSavedConfigs(updated);
    setSavedConfigs(updated);
  };

  const handleTestTypeChange = (type: TestType) => {
    setTestType(type);
    setVus(TEST_TYPE_VUS[type].vus);
    setDuration(TEST_TYPE_VUS[type].duration);
  };

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[index][field] = val;
    setHeaders(updated);
  };

  const handleAddRequest = () => {
    setAdditionalRequests([...additionalRequests, { name: '', url: '', method: 'GET' }]);
  };

  const handleRemoveRequest = (index: number) => {
    setAdditionalRequests(additionalRequests.filter((_, i) => i !== index));
  };

  const handleRun = () => {
    if (!targetUrl.trim()) return;

    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim()) headersObj[h.key.trim()] = h.value;
    });

    let parsedBody: any = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        parsedBody = JSON.parse(requestBody);
        setBodyError(null);
      } catch (e: any) {
        setBodyError(`Invalid JSON: ${e.message}`);
        return; // Don't run with invalid JSON
      }
    }

    const config: PerfRunConfig = {
      projectId,
      testType,
      targetUrl: targetUrl.trim(),
      method,
      expectedStatus: parseInt(expectedStatus, 10) || 200,
      headers: headersObj,
      body: parsedBody,
      additionalRequests: additionalRequests
        .filter((r) => r.name && r.url)
        .map((r) => ({
          ...r,
          headers: r.headers || {},
          body: r.body ? JSON.parse(r.body) : undefined,
        })),
    };

    onRun(config);
  };

  const showBody = ['POST', 'PUT', 'PATCH'].includes(method);

  return (
    <div className="space-y-5">
      {/* Test Type Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{t('runner.performance.testType')}</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(TEST_TYPE_VUS) as TestType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleTestTypeChange(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                testType === type
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                  : 'bg-card text-slate-400 border border-border hover:border-slate-500'
              }`}
            >
              {t(`runner.performance.testType.${type}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">{t(`runner.performance.testTypeDescription.${testType}`)}</p>
      </div>

      {/* Target URL */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{t('runner.performance.targetUrl')}</label>
        <input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://api.example.com/auth/login"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
        />
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{t('runner.performance.method')}</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-sky-500 text-sm"
        >
          <option value="GET">{t('runner.performance.httpMethod.get')}</option>
          <option value="POST">{t('runner.performance.httpMethod.post')}</option>
          <option value="PUT">{t('runner.performance.httpMethod.put')}</option>
          <option value="PATCH">{t('runner.performance.httpMethod.patch')}</option>
          <option value="DELETE">{t('runner.performance.httpMethod.delete')}</option>
        </select>
      </div>

      {/* Expected Status */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{t('runner.performance.expectedStatusCode')}</label>
        <input
          type="number"
          value={expectedStatus}
          onChange={(e) => setExpectedStatus(e.target.value)}
          min={100}
          max={599}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-sky-500 text-sm"
        />
        <p className="text-xs text-slate-600 mt-1">{t('runner.performance.expectedStatusHint')}</p>
      </div>

      {/* Headers */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{t('runner.performance.headers')}</label>
        <div className="space-y-2">
          {headers.map((header, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={header.key}
                onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                placeholder={t('runner.performance.headerKey')}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-foreground placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
              />
              <input
                type="text"
                value={header.value}
                onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                placeholder={t('runner.performance.headerValue')}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-foreground placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
              />
              <button
                onClick={() => handleRemoveHeader(i)}
                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddHeader}
          className="mt-2 text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
        >
          <FiPlus className="h-3 w-3" /> {t('runner.performance.addHeader')}
        </button>
      </div>

      {/* Request Body */}
      {showBody && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">{t('runner.performance.requestBody')}</label>
          <textarea
            value={requestBody}
            onChange={(e) => { setRequestBody(e.target.value); setBodyError(null); }}
            rows={5}
            className={`w-full px-3 py-2 bg-background border rounded-lg text-foreground font-mono text-sm placeholder-slate-600 focus:outline-none resize-none ${
              bodyError ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-sky-500'
            }`}
          />
          {bodyError && (
            <p className="text-xs text-red-400 mt-1">{bodyError}</p>
          )}
        </div>
      )}

      {/* Test Settings */}
      <div className="border-t border-border pt-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">{t('runner.performance.testSettings')}</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('runner.performance.virtualUsers')}</label>
            <input
              type="text"
              value={vus}
              onChange={(e) => setVus(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('runner.performance.duration')}</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Additional Requests */}
      <div className="border-t border-border pt-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {t('runner.performance.additionalRequests')} <span className="text-slate-500 font-normal">({t('runner.performance.optional')})</span>
        </label>
        {additionalRequests.map((req, i) => (
          <div key={i} className="bg-background border border-border rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={req.name}
                onChange={(e) => {
                  const updated = [...additionalRequests];
                  updated[i].name = e.target.value;
                  setAdditionalRequests(updated);
                }}
                placeholder={t('runner.performance.requestName')}
                className="flex-1 px-2 py-1 bg-transparent border-b border-border text-foreground text-sm focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleRemoveRequest(i)}
                className="ms-2 p-1 text-slate-500 hover:text-red-400"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <select
                value={req.method}
                onChange={(e) => {
                  const updated = [...additionalRequests];
                  updated[i].method = e.target.value;
                  setAdditionalRequests(updated);
                }}
                className="px-2 py-1 bg-card border border-border rounded text-foreground text-xs"
              >
                <option value="GET">{t('runner.performance.httpMethod.get')}</option>
                <option value="POST">{t('runner.performance.httpMethod.post')}</option>
                <option value="PUT">{t('runner.performance.httpMethod.put')}</option>
                <option value="DELETE">{t('runner.performance.httpMethod.delete')}</option>
              </select>
              <input
                type="text"
                value={req.url}
                onChange={(e) => {
                  const updated = [...additionalRequests];
                  updated[i].url = e.target.value;
                  setAdditionalRequests(updated);
                }}
                placeholder="https://api.example.com/endpoint"
                className="px-2 py-1 bg-card border border-border rounded text-foreground text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        ))}
        <button
          onClick={handleAddRequest}
          className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
        >
          <FiPlus className="h-3 w-3" /> {t('runner.performance.addAnotherRequest')}
        </button>
      </div>

      {/* Saved Configs */}
      <div className="border-t border-border pt-4 flex gap-2">
        {savedConfigs.length > 0 && (
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 border border-border rounded-lg hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            <FiBookmark className="h-3 w-3" /> {t('runner.performance.loadSaved', { count: savedConfigs.length })}
          </button>
        )}
        {targetUrl.trim() && (
          <button
            onClick={() => setShowSaveInput(!showSaveInput)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 border border-border rounded-lg hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            <FiSave className="h-3 w-3" /> {t('runner.performance.saveConfig')}
          </button>
        )}
      </div>

      {showSaveInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={t('runner.performance.configNamePlaceholder')}
            className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-sky-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig()}
          />
          <button
            onClick={handleSaveConfig}
            disabled={!saveName.trim()}
            className="px-3 py-1.5 bg-sky-500/20 text-sky-400 border border-sky-500/50 rounded-lg text-xs hover:bg-sky-500/30 disabled:opacity-50"
          >
            {t('runner.performance.save')}
          </button>
        </div>
      )}

      {showSaved && savedConfigs.length > 0 && (
        <div className="space-y-1.5">
          {savedConfigs.map((cfg) => (
            <div key={cfg.name} className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg">
              <button onClick={() => handleLoadConfig(cfg)} className="flex-1 text-start">
                <div className="text-xs font-medium text-foreground">{cfg.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{cfg.method} {cfg.targetUrl}</div>
              </button>
              <button onClick={() => handleDeleteConfig(cfg.name)} className="text-slate-600 hover:text-red-400">
                <FiTrash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isRunning || !targetUrl.trim()}
        className={`w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
          isRunning || !targetUrl.trim()
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-sky-500 hover:bg-sky-400 text-foreground'
        }`}
      >
        <FiPlay className="h-4 w-4" />
        {isRunning ? t('runner.performance.testRunning') : t('runner.performance.runTest')}
      </button>
    </div>
  );
};
