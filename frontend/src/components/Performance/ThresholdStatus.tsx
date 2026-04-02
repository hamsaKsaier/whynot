import React from 'react';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface ThresholdStatusProps {
  thresholds: Record<string, { passed: boolean; actual: string }>;
}

export const ThresholdStatus: React.FC<ThresholdStatusProps> = ({ thresholds }) => {
  const entries = Object.entries(thresholds);

  if (entries.length === 0) return null;

  const allPassed = entries.every(([, v]) => v.passed);

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-slate-300">Thresholds</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          allPassed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {entries.filter(([, v]) => v.passed).length}/{entries.length} passed
        </span>
      </div>
      <div className="space-y-2">
        {entries.map(([key, { passed, actual }]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            {passed ? (
              <FiCheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <FiXCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            )}
            <span className={passed ? 'text-emerald-300' : 'text-red-300'}>
              {key}
            </span>
            <span className="text-slate-500 text-xs truncate">{actual}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
