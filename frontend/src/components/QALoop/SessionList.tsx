/**
 * SessionList — "Recent Sessions" card extracted from QALoopPage (5.1).
 */
import React from 'react';
import { Card } from '../common/Card';
import { FiClock } from 'react-icons/fi';
import { QALoopSession } from '../../services/qa-loop-api';

function safeHostname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).hostname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':   return 'text-blue-500';
    case 'completed': return 'text-green-500';
    case 'paused':    return 'text-yellow-500';
    case 'failed':    return 'text-red-500';
    case 'cancelled': return 'text-gray-500';
    default:          return 'text-gray-400';
  }
}

export interface SessionListProps {
  sessions: QALoopSession[];
  activeSession: QALoopSession | null;
  isLoading: boolean;
  onSelect: (session: QALoopSession) => void;
  /** 6.6 — pagination */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  activeSession,
  isLoading,
  onSelect,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <FiClock className="text-blue-500" />
      Recent Sessions
    </h2>

    {isLoading ? (
      <div className="text-center py-4 text-gray-500">Loading...</div>
    ) : sessions.length === 0 ? (
      <div className="text-center py-8">
        <FiClock className="h-8 w-8 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400 mb-3">No sessions yet</p>
        <button
          onClick={() => {
            const el = document.getElementById('target-url-input');
            el?.focus();
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          Start your first exploration →
        </button>
      </div>
    ) : (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sessions.map(session => (
          <button
            key={session.id}
            onClick={() => onSelect(session)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              activeSession?.id === session.id
                ? 'border-sky-500 bg-sky-50 shadow-md ring-1 ring-sky-300'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 truncate">
                {safeHostname(session.target_url, session.target_url)}
              </span>
              <span className={`text-xs font-medium ${getStatusColor(session.status)}`}>
                {session.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>{session.pages_explored} pages</span>
              <span>{session.tests_generated} tests</span>
              <span>{session.bugs_found} bugs</span>
            </div>
          </button>
        ))}

        {/* 6.6 — Load more */}
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full mt-1 py-2 text-sm text-center text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    )}
  </Card>
);
