import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');
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
      positive: 'bg-green-900/30 text-green-400 border-green-800',
      negative: 'bg-red-900/30 text-red-400 border-red-800',
      edge: 'bg-blue-900/30 text-blue-400 border-blue-800',
    };
    
    const color = colors[scenarioType as keyof typeof colors] || 'bg-muted text-foreground border-border';
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
        {scenarioType.charAt(0).toUpperCase() + scenarioType.slice(1)}
      </span>
    );
  };

  const getRiskLevelBadge = (riskLevel?: string) => {
    if (!riskLevel) return null;
    
    const colors = {
      high: 'bg-red-900/30 text-red-400',
      medium: 'bg-yellow-900/30 text-yellow-400',
      low: 'bg-muted text-foreground',
    };

    const color = colors[riskLevel as keyof typeof colors] || 'bg-muted text-foreground';
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {t('runner.generation.risk')}: {riskLevel}
      </span>
    );
  };

  const getValidationResult = (testCaseId: string): ValidationResult | undefined => {
    return validationResults?.find(r => r.test_case_id === testCaseId);
  };

  return (
    <Card title={t('runner.generation.title', { count: testCases.length })} className="mb-6">
      {/* Validation Summary */}
      {validationSummary && (
        <div className="mb-4 p-3 bg-muted rounded-lg border border-border">
          <div className="flex items-center gap-4 flex-wrap">
            {validationSummary.valid > 0 && (
              <div className="flex items-center gap-2">
                <StatusBadge status="success" size="sm" />
                <span className="text-sm text-foreground">
                  <span className="font-medium">{validationSummary.valid}</span> {t('runner.generation.valid')}
                </span>
              </div>
            )}
            {validationSummary.warnings > 0 && (
              <div className="flex items-center gap-2">
                <StatusBadge status="warning" size="sm" />
                <span className="text-sm text-foreground">
                  <span className="font-medium">{validationSummary.warnings}</span> {t('runner.generation.warnings')}
                </span>
              </div>
            )}
            {validationSummary.invalid > 0 && (
              <div className="flex items-center gap-2">
                <StatusBadge status="error" size="sm" />
                <span className="text-sm text-foreground">
                  <span className="font-medium">{validationSummary.invalid}</span> {t('runner.generation.invalid')}
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
            className="border border-border rounded-lg overflow-hidden"
          >
            <div className="bg-muted px-4 py-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-foreground">{testCase.name}</h4>
                  {getScenarioTypeBadge(testCase.scenario_type)}
                  {getRiskLevelBadge(testCase.risk_level)}
                  {testCase.priority_score !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {t('runner.generation.priority')}: {testCase.priority_score}
                    </span>
                  )}
                </div>
                {testCase.description && (
                  <p className="text-sm text-muted-foreground mt-1">{testCase.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {testCase.steps.length} {t('runner.execution.steps')}
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
                  <FiPlay className="me-1" />
                  {t('runner.runTest')}
                </Button>
                {onDelete && (
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, testCase })}
                    className="p-2 text-red-600 hover:bg-red-900/20 rounded transition-colors"
                    title={t('runner.generation.deleteTestCase')}
                    aria-label={t('runner.generation.deleteTestCase')}
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => toggleExpand(testCase.id)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                  aria-label={t('runner.generation.toggleDetails')}
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
              <div className="px-4 py-3 bg-card border-t border-border">
                <div className="space-y-3">
                  {testCase.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getActionIcon(step.action)}</span>
                          <span className="font-medium text-foreground capitalize">
                            {step.action}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{step.description}</p>
                        {step.target && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium">{t('runner.generation.target')}:</span>{' '}
                            {step.target.text || step.target.role || step.target.placeholder || t('runner.generation.element')}
                          </div>
                        )}
                        {step.value && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">{t('runner.generation.value')}:</span> {step.value}
                          </div>
                        )}
                        {step.expected_outcome && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">{t('runner.generation.expected')}:</span> {step.expected_outcome}
                          </div>
                        )}
                      </div>
                      {/* Fix/Edit Icon */}
                      {onStepFix && (
                        <div className="flex-shrink-0 ms-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStepFix(testCase, index, step);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-900/20 rounded transition-colors"
                            title={t('runner.generation.fixStep')}
                            aria-label={t('runner.generation.fixStep')}
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
        title={t('runner.generation.deleteTitle')}
        message={t('runner.generation.deleteMessage', { name: deleteConfirm.testCase?.name })}
        confirmText={t('runner.generation.delete')}
        cancelText={t('runner.generation.cancel')}
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





