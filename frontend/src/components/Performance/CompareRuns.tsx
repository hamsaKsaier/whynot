import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiArrowUp, FiArrowDown, FiMinus } from 'react-icons/fi';
import type { PerfRun } from '../../services/perf-api';

interface CompareRunsProps {
  runA: PerfRun;
  runB: PerfRun;
  onClose: () => void;
}

function delta(a: number | null, b: number | null): { value: string; direction: 'better' | 'worse' | 'same'; pct: string } {
  const av = a ?? 0;
  const bv = b ?? 0;
  if (av === 0 && bv === 0) return { value: '0', direction: 'same', pct: '0%' };
  const diff = bv - av;
  const pct = av !== 0 ? Math.round((diff / av) * 100) : 0;
  return {
    value: diff > 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`,
    direction: diff === 0 ? 'same' : diff > 0 ? 'worse' : 'better',
    pct: `${pct > 0 ? '+' : ''}${pct}%`,
  };
}

function deltaInverted(a: number | null, b: number | null): { value: string; direction: 'better' | 'worse' | 'same'; pct: string } {
  // For metrics where higher is better (e.g., throughput)
  const r = delta(a, b);
  return { ...r, direction: r.direction === 'better' ? 'worse' : r.direction === 'worse' ? 'better' : 'same' };
}

function DeltaCell({ d, unit }: { d: { value: string; direction: string; pct: string }; unit: string }) {
  const color = d.direction === 'better' ? 'text-emerald-400' : d.direction === 'worse' ? 'text-red-400' : 'text-slate-500';
  const Icon = d.direction === 'better' ? FiArrowDown : d.direction === 'worse' ? FiArrowUp : FiMinus;
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {d.pct} ({d.value}{unit})
    </span>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export const CompareRuns: React.FC<CompareRunsProps> = ({ runA, runB, onClose }) => {
  const { t } = useTranslation('runner');
  const rows = [
    { label: t('runner.performance.totalRequests'), a: runA.total_requests, b: runB.total_requests, unit: '', invert: true },
    { label: t('runner.performance.avgResponseTime'), a: runA.avg_response_time_ms, b: runB.avg_response_time_ms, unit: 'ms', invert: false },
    { label: t('runner.performance.p95ResponseTime'), a: runA.p95_response_time_ms, b: runB.p95_response_time_ms, unit: 'ms', invert: false },
    { label: t('runner.performance.p99ResponseTime'), a: runA.p99_response_time_ms, b: runB.p99_response_time_ms, unit: 'ms', invert: false },
    { label: t('runner.performance.throughputReqS'), a: runA.requests_per_second, b: runB.requests_per_second, unit: '', invert: true },
    { label: t('runner.performance.errorRate'), a: runA.failed_requests && runA.total_requests ? (runA.failed_requests / runA.total_requests) * 100 : 0, b: runB.failed_requests && runB.total_requests ? (runB.failed_requests / runB.total_requests) * 100 : 0, unit: '%', invert: false },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">{t('runner.performance.compareRuns')}</h3>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">{t('runner.performance.close')}</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-border">
            <th className="text-start py-2 font-medium">{t('runner.performance.metric')}</th>
            <th className="text-end py-2 font-medium">
              <div className="capitalize">{runA.test_type}</div>
              <div className="text-[10px] text-slate-600">{formatDate(runA.created_at)}</div>
            </th>
            <th className="text-end py-2 font-medium">
              <div className="capitalize">{runB.test_type}</div>
              <div className="text-[10px] text-slate-600">{formatDate(runB.created_at)}</div>
            </th>
            <th className="text-end py-2 font-medium">{t('runner.performance.change')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, a, b, unit, invert }) => {
            const d = invert ? deltaInverted(a, b) : delta(a, b);
            return (
              <tr key={label} className="border-b border-border/50">
                <td className="py-2 text-slate-400">{label}</td>
                <td className="py-2 text-end text-foreground tabular-nums">{a != null ? `${Math.round(a as number)}${unit}` : '—'}</td>
                <td className="py-2 text-end text-foreground tabular-nums">{b != null ? `${Math.round(b as number)}${unit}` : '—'}</td>
                <td className="py-2 text-end"><DeltaCell d={d} unit={unit} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
