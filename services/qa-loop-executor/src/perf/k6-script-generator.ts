/**
 * k6-script-generator.ts
 *
 * Generates k6 JavaScript test scripts from user configuration.
 */

export interface PerfTestConfig {
  testType: 'smoke' | 'load' | 'stress' | 'spike';
  targetUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  config?: {
    vus?: number;
    duration?: string;
    stages?: Array<{ duration: string; target: number }>;
  };
  thresholds?: Record<string, string[]>;
  additionalRequests?: Array<{
    name: string;
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  }>;
}

/** Preset stage configurations per test type */
const PRESETS: Record<string, { stages: Array<{ duration: string; target: number }>; description: string }> = {
  smoke: {
    stages: [
      { duration: '30s', target: 1 },
    ],
    description: 'Quick validation — 1 user, 30 seconds',
  },
  load: {
    stages: [
      { duration: '2m', target: 20 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 0 },
    ],
    description: 'Normal traffic — ramps from 20 to 50 users over 9 minutes',
  },
  stress: {
    stages: [
      { duration: '3m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 150 },
      { duration: '4m', target: 0 },
    ],
    description: 'Breaking point — ramps to 150 users over 17 minutes',
  },
  spike: {
    stages: [
      { duration: '1m', target: 5 },
      { duration: '30s', target: 200 },
      { duration: '1m', target: 200 },
      { duration: '30s', target: 5 },
      { duration: '2m', target: 0 },
    ],
    description: 'Sudden surge — spikes to 200 users for 1 minute',
  },
};

export function getPresetConfig(testType: string) {
  return PRESETS[testType] || PRESETS.load;
}

function generateAdditionalRequestCode(req: { name: string; url: string; method: string; headers?: Record<string, string>; body?: any }): string {
  const method = req.method.toLowerCase();
  const hasBody = method === 'post' || method === 'put' || method === 'patch';
  const headersStr = req.headers ? JSON.stringify(req.headers, null, 4) : '{}';
  const bodyStr = req.body ? JSON.stringify(req.body) : '""';

  let code = `\n  // Additional request: ${req.name}\n`;
  code += `  const ${req.name.replace(/[^a-zA-Z0-9_]/g, '_')}_params = { headers: ${headersStr}, tags: { name: "${req.name}" } };\n`;

  if (hasBody) {
    code += `  const ${req.name.replace(/[^a-zA-Z0-9_]/g, '_')}_res = http.${method}("${req.url}", JSON.stringify(${bodyStr}), ${req.name.replace(/[^a-zA-Z0-9_]/g, '_')}_params);\n`;
  } else {
    code += `  const ${req.name.replace(/[^a-zA-Z0-9_]/g, '_')}_res = http.${method}("${req.url}", ${req.name.replace(/[^a-zA-Z0-9_]/g, '_')}_params);\n`;
  }

  code += `  check(${req.name.replace(/[^a-zA-Z0-9_]/g, '_')}_res, { "${req.name} no server error": (r) => r.status < 500 });\n`;
  return code;
}

export function generateK6Script(config: PerfTestConfig): string {
  const preset = PRESETS[config.testType] || PRESETS.load;
  const stages = config.config?.stages || preset.stages;
  const thresholds = config.thresholds || {
    http_req_duration: ['p(95)<2000'],
  };
  const method = (config.method || 'POST').toLowerCase();
  const hasBody = method === 'post' || method === 'put' || method === 'patch';
  const headers = config.headers || { 'Content-Type': 'application/json' };
  const body = config.body || {};

  const additionalCode = (config.additionalRequests || [])
    .map(r => generateAdditionalRequestCode(r))
    .join('\n');

  // Generate k6 script that:
  // - Tracks status codes via custom counters (for breakdown in results)
  // - Only counts 5xx as "server errors" (4xx means server is working correctly)
  // - Reports response times, throughput, and status code distribution
  return `import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics for accurate reporting
const serverErrors = new Counter("server_errors");       // 5xx only
const clientErrors = new Counter("client_errors");       // 4xx
const successCount = new Counter("success_count");       // 2xx + 3xx
const requestDuration = new Trend("request_duration", true);

export const options = {
  stages: ${JSON.stringify(stages, null, 2)},
  thresholds: ${JSON.stringify(thresholds, null, 2)},
};

export default function () {
  const payload = JSON.stringify(${JSON.stringify(body)});
  const params = {
    headers: ${JSON.stringify(headers, null, 4)},
    tags: { name: "main-request" },
  };

  const response = http.${method}("${config.targetUrl}"${hasBody ? ', payload, params' : ', params'});

  // Track status code categories
  if (response.status >= 500) {
    serverErrors.add(1);
  } else if (response.status >= 400) {
    clientErrors.add(1);
  } else {
    successCount.add(1);
  }

  check(response, {
    "no server error (5xx)": (r) => r.status < 500,
    "response time < 2s": (r) => r.timings.duration < 2000,
  });

  requestDuration.add(response.timings.duration);
${additionalCode}
  sleep(Math.random() * 2 + 1);
}
`;
}
