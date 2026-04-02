import React, { useState } from 'react';
import { FiPlus, FiTrash2, FiPlay } from 'react-icons/fi';
import type { PerfRunConfig } from '../../services/perf-api';

interface TestConfigProps {
  onRun: (config: PerfRunConfig) => void;
  isRunning: boolean;
  projectId?: string;
}

type TestType = 'smoke' | 'load' | 'stress' | 'spike';

const TEST_TYPE_INFO: Record<TestType, { label: string; description: string; vus: string; duration: string }> = {
  smoke: {
    label: 'Smoke',
    description: 'Quick validation — 1 user, 30 seconds',
    vus: '1',
    duration: '30s',
  },
  load: {
    label: 'Load',
    description: 'Normal traffic — ramps from 20 to 50 users over 9 minutes',
    vus: '50',
    duration: '9m',
  },
  stress: {
    label: 'Stress',
    description: 'Breaking point — ramps to 150 users over 17 minutes',
    vus: '150',
    duration: '17m',
  },
  spike: {
    label: 'Spike',
    description: 'Sudden surge — spikes to 200 users for 1 minute',
    vus: '200',
    duration: '5m',
  },
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
  const [testType, setTestType] = useState<TestType>('load');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState<HeaderEntry[]>([
    { key: 'Content-Type', value: 'application/json' },
  ]);
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [vus, setVus] = useState(TEST_TYPE_INFO.load.vus);
  const [duration, setDuration] = useState(TEST_TYPE_INFO.load.duration);
  const [additionalRequests, setAdditionalRequests] = useState<AdditionalRequest[]>([]);

  const handleTestTypeChange = (type: TestType) => {
    setTestType(type);
    setVus(TEST_TYPE_INFO[type].vus);
    setDuration(TEST_TYPE_INFO[type].duration);
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
      } catch {
        parsedBody = {};
      }
    }

    const config: PerfRunConfig = {
      projectId,
      testType,
      targetUrl: targetUrl.trim(),
      method,
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
        <label className="block text-sm font-medium text-slate-300 mb-2">Test Type</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(TEST_TYPE_INFO) as TestType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleTestTypeChange(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                testType === type
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                  : 'bg-[#1e293b] text-slate-400 border border-[#334155] hover:border-slate-500'
              }`}
            >
              {TEST_TYPE_INFO[type].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">{TEST_TYPE_INFO[testType].description}</p>
      </div>

      {/* Target URL */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Target URL</label>
        <input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://api.example.com/auth/login"
          className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
        />
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white focus:outline-none focus:border-sky-500 text-sm"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {/* Headers */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Headers</label>
        <div className="space-y-2">
          {headers.map((header, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={header.key}
                onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                placeholder="Key"
                className="flex-1 px-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
              />
              <input
                type="text"
                value={header.value}
                onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 px-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
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
          <FiPlus className="h-3 w-3" /> Add Header
        </button>
      </div>

      {/* Request Body */}
      {showBody && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Request Body (JSON)</label>
          <textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none"
          />
        </div>
      )}

      {/* Test Settings */}
      <div className="border-t border-[#334155] pt-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">Test Settings</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Virtual Users</label>
            <input
              type="text"
              value={vus}
              onChange={(e) => setVus(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Duration</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Additional Requests */}
      <div className="border-t border-[#334155] pt-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Additional Requests <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        {additionalRequests.map((req, i) => (
          <div key={i} className="bg-[#0f172a] border border-[#334155] rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={req.name}
                onChange={(e) => {
                  const updated = [...additionalRequests];
                  updated[i].name = e.target.value;
                  setAdditionalRequests(updated);
                }}
                placeholder="Request name"
                className="flex-1 px-2 py-1 bg-transparent border-b border-[#334155] text-white text-sm focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleRemoveRequest(i)}
                className="ml-2 p-1 text-slate-500 hover:text-red-400"
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
                className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-white text-xs"
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
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
                className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        ))}
        <button
          onClick={handleAddRequest}
          className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
        >
          <FiPlus className="h-3 w-3" /> Add Another Request
        </button>
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isRunning || !targetUrl.trim()}
        className={`w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
          isRunning || !targetUrl.trim()
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-sky-500 hover:bg-sky-400 text-white'
        }`}
      >
        <FiPlay className="h-4 w-4" />
        {isRunning ? 'Test Running...' : 'Run Test'}
      </button>
    </div>
  );
};
