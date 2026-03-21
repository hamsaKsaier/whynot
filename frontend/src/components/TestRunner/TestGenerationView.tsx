import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TestCaseValidationBadge } from '../common/TestCaseValidationBadge';
import { StatusBadge } from '../common/StatusBadge';
import { FiChevronDown, FiChevronUp, FiPlay, FiTrash2, FiEdit } from 'react-icons/fi';
import type { TestCase, TestStep, ValidationResult, ValidationSummary } from '../../types';

interface TestGenerationViewProps {
  testCases: TestCase[];
  validationSummary?: ValidationSummary;
  validationResults?: ValidationResult[];
  onRunTest: (testCase: TestCase, headless?: boolean) => void;
  onDelete?: (testCase: TestCase) => void;
  onStepFix?: (testCase: TestCase, stepIndex: number, step: TestStep) => void;
  isLoading?: boolean;
  headless?: boolean;
}

export const TestGenerationView: React.FC<TestGenerationViewProps> = ({
  testCases,
  validationSummary,
  validationResults,
  onRunTest,
  onDelete,
  onStepFix,
  isLoading = false,
  headless = false,
}) => {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; testCase: TestCase | null }>({
    isOpen: false,
    testCase: null,
  });

  if (testCases.length === 0) {
    return null;
  }

  const toggleExpand = (testId: string) => {
    setExpandedTest(expandedTest === testId ? null : testId);
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      navigate: '🌐',
      click: '👆',
      type: '⌨️',
      fill: '✍️',
      wait: '⏳',
      assert: '✓',
      scroll: '📜',
      hover: '🖱️',
    };
    return icons[action.toLowerCase()] || '•';
  };

  const getScenarioTypeBadge = (scenarioType?: string) => {
    if (!scenarioType) return null;
    
    const colors = {
      positive: 'bg-green-100 text-green-800 border-green-200',
      negative: 'bg-red-100 text-red-800 border-red-200',
      edge: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    
    const color = colors[scenarioType as keyof typeof colors] || 'bg-slate-900 text-slate-200 border-slate-700';
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
        {scenarioType.charAt(0).toUpperCase() + scenarioType.slice(1)}
      </span>
    );
  };

  const getRiskLevelBadge = (riskLevel?: string) => {
    if (!riskLevel) return null;
    
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-slate-900 text-slate-200',
    };
    
    const color = colors[riskLevel as keyof typeof colors] || 'bg-slate-900 text-slate-200';
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        Risk: {riskLevel}
      </span>
    );
  };

  const getValidationResult = (testCaseId: string): ValidationResult | undefined => {
    return validationResults?.find(r => r.test_case_id === testCaseId);
  };

  return (
    <Card title={`Generated Test Cases (${testCases.length})`} className="mb-6">
      {/* Validation Summary */}
      {validationSummary && (
        <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
          <div className="flex items-center gap-4 flex-wrap">
            {validationSummary.valid > 0 && (
              <div className="flex items-center gap-2">
                <StatusBadge status="success" size="sm" />
                <span className="text-sm text-slate-200">
                  <span className="font-medium">{validationSummary.valid}</span> valid
                </span>
              </div>
            )}
            {validationSummary.warnings > 0 && (
              <div className="flex items-center gap-2">
                <StatusBadge status="warning" size="sm" />
                <span className="text-sm text-slate-200">
                  <span className="font-medium">{validationSummary.warnings}</span> warnings
                </span>
              </div>
            )}
            {validationSummary.invalid > 0 && (
              <div className="flex items-center gap-2">
                <StatusBadge status="error" size="sm" />
                <span className="text-sm text-slate-200">
                  <span className="font-medium">{validationSummary.invalid}</span> invalid
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {testCases.map((testCase) => (
          <div
            key={testCase.id}
            className="border border-slate-700 rounded-lg overflow-hidden"
          >
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-white">{testCase.name}</h4>
                  {getScenarioTypeBadge(testCase.scenario_type)}
                  {getRiskLevelBadge(testCase.risk_level)}
                  {testCase.priority_score !== undefined && (
                    <span className="text-xs text-slate-400">
                      Priority: {testCase.priority_score}
                    </span>
                  )}
                </div>
                {testCase.description && (
                  <p className="text-sm text-slate-400 mt-1">{testCase.description}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <TestCaseValidationBadge
                    validationResult={getValidationResult(testCase.id)}
                    testCaseId={testCase.id}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => onRunTest(testCase, headless)}
                  disabled={isLoading}
                  isLoading={isLoading}
                >
                  <FiPlay className="mr-1" />
                  Run Test
                </Button>
                {onDelete && (
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, testCase })}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete test case"
                    aria-label="Delete test case"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => toggleExpand(testCase.id)}
                  className="p-2 text-slate-400 hover:text-slate-200"
                  aria-label="Toggle details"
                >
                  {expandedTest === testCase.id ? (
                    <FiChevronUp className="h-5 w-5" />
                  ) : (
                    <FiChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {expandedTest === testCase.id && (
              <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
                <div className="space-y-3">
                  {testCase.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getActionIcon(step.action)}</span>
                          <span className="font-medium text-white capitalize">
                            {step.action}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200">{step.description}</p>
                        {step.target && (
                          <div className="mt-2 text-xs text-slate-400">
                            <span className="font-medium">Target:</span>{' '}
                            {step.target.text || step.target.role || step.target.placeholder || 'Element'}
                          </div>
                        )}
                        {step.value && (
                          <div className="mt-1 text-xs text-slate-400">
                            <span className="font-medium">Value:</span> {step.value}
                          </div>
                        )}
                        {step.expected_outcome && (
                          <div className="mt-1 text-xs text-slate-400">
                            <span className="font-medium">Expected:</span> {step.expected_outcome}
                          </div>
                        )}
                      </div>
                      {/* Fix/Edit Icon */}
                      {onStepFix && (
                        <div className="flex-shrink-0 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStepFix(testCase, index, step);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Fix or modify this step"
                            aria-label="Fix or modify this step"
                          >
                            <FiEdit className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Test Case"
        message={`Are you sure you want to delete "${deleteConfirm.testCase?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm.testCase && onDelete) {
            onDelete(deleteConfirm.testCase);
          }
          setDeleteConfirm({ isOpen: false, testCase: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, testCase: null })}
      />
    </Card>
  );
};





