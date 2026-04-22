/**
 * Centralized frontend configuration.
 *
 * All import.meta.env reads MUST go through this module.
 * This ensures a single place to manage defaults and types.
 */

function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;
  // Auto-promote to wss:// when served over HTTPS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `wss://${window.location.host}/ws`;
  }
  return 'ws://localhost:3011';
}

function getQaLoopWsUrl(): string {
  const explicit = import.meta.env.VITE_QA_LOOP_WS_URL;
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `wss://${window.location.host}`;
  }
  return 'ws://localhost:3012';
}

export const config = {
  /** Backend API base URL (relative path works behind a reverse proxy). */
  apiUrl: import.meta.env.VITE_API_URL || '/api',

  /** WebSocket URL for test executor streaming. */
  wsUrl: getWsUrl(),

  /** WebSocket URL for QA Loop real-time events. */
  qaLoopWsUrl: getQaLoopWsUrl(),

  /** Application version shown in the footer. */
  appVersion: import.meta.env.VITE_APP_VERSION || '2.0.0',

  /** True when running in Vite dev mode. */
  isDev: import.meta.env.DEV ?? import.meta.env.MODE === 'development',
} as const;
