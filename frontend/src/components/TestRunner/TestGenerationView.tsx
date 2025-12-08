import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FiChevronDown, FiChevronUp, FiPlay, FiTrash2 } from 'react-icons/fi';
import type { TestCase } from '../../types';

interface TestGenerationViewProps {
  testCases: TestCase[];
  onRunTest: (testCase: TestCase, headless?: boolean) => void;
  onDelete?: (testCase: TestCase) => void;
  isLoading?: boolean;
  headless?: boolean;
}

export const TestGenerationView: React.FC<TestGenerationViewProps> = ({
  testCases,
  onRunTest,
  onDelete,
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

  return (
    <Card title={`Generated Test Cases (${testCases.length})`} className="mb-6">
      <div className="space-y-4">
        {testCases.map((testCase) => (
          <div
            key={testCase.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{testCase.name}</h4>
                {testCase.description && (
                  <p className="text-sm text-gray-600 mt-1">{testCase.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                  className="p-2 text-gray-500 hover:text-gray-700"
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
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <div className="space-y-3">
                  {testCase.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getActionIcon(step.action)}</span>
                          <span className="font-medium text-gray-900 capitalize">
                            {step.action}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{step.description}</p>
                        {step.target && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span className="font-medium">Target:</span>{' '}
                            {step.target.text || step.target.role || step.target.placeholder || 'Element'}
                          </div>
                        )}
                        {step.value && (
                          <div className="mt-1 text-xs text-gray-500">
                            <span className="font-medium">Value:</span> {step.value}
                          </div>
                        )}
                        {step.expected_outcome && (
                          <div className="mt-1 text-xs text-gray-500">
                            <span className="font-medium">Expected:</span> {step.expected_outcome}
                          </div>
                        )}
                      </div>
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





