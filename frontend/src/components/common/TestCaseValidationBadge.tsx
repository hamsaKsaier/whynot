import React, { useState } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import type { ValidationResult } from '../../types';

interface TestCaseValidationBadgeProps {
  validationResult?: ValidationResult;
  testCaseId: string;
}

export const TestCaseValidationBadge: React.FC<TestCaseValidationBadgeProps> = ({
  validationResult,
  testCaseId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!validationResult) {
    return null;
  }

  const { is_valid, score, errors, warnings } = validationResult;
  const hasIssues = errors.length > 0 || warnings.length > 0;

  const getStatusColor = () => {
    if (!is_valid) return 'text-red-600 bg-red-900/20 border-red-800';
    if (warnings.length > 0) return 'text-yellow-600 bg-yellow-900/20 border-yellow-700';
    return 'text-green-600 bg-green-900/20 border-green-800';
  };

  const getStatusIcon = () => {
    if (!is_valid) return <FiXCircle className="h-4 w-4" />;
    if (warnings.length > 0) return <FiAlertCircle className="h-4 w-4" />;
    return <FiCheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!is_valid) return 'Invalid';
    if (warnings.length > 0) return 'Valid (Warnings)';
    return 'Valid';
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${getStatusColor()}`}
        title={hasIssues ? 'Click to view details' : ''}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        {score !== undefined && (
          <span className="text-xs opacity-75">({score}/100)</span>
        )}
        {hasIssues && (
          <span className="ml-1">
            {isExpanded ? <FiChevronUp className="h-3 w-3" /> : <FiChevronDown className="h-3 w-3" />}
          </span>
        )}
      </button>

      {isExpanded && hasIssues && (
        <div className="absolute mt-10 z-10 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-4 min-w-[300px] max-w-md">
          <div className="space-y-3">
            {errors.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-300 mb-2 flex items-center gap-2">
                  <FiXCircle className="h-4 w-4" />
                  Errors ({errors.length})
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div>
                <h4 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                  <FiAlertCircle className="h-4 w-4" />
                  Warnings ({warnings.length})
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                  {warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
