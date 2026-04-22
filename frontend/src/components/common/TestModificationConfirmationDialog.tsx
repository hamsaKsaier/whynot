import React from 'react';
import { Button } from './Button';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import type { ExecutionResult, TestCase } from '../../types';

interface TestModificationConfirmationDialogProps {
  isOpen: boolean;
  testResult: ExecutionResult | null;
  originalTestCase: TestCase;
  modifiedTestCase: TestCase;
  onAccept: () => void;
  onReject: () => void;
  onTryAgain: () => void;
}

export const TestModificationConfirmationDialog: React.FC<TestModificationConfirmationDialogProps> = ({
  isOpen,
  testResult,
  originalTestCase,
  modifiedTestCase,
  onAccept,
  onReject,
  onTryAgain,
}) => {
  if (!isOpen) return null;

  const isSuccess = testResult?.status === 'completed' && 
                    testResult.steps.every(s => s.success !== false);
  
  const passedSteps = testResult?.steps.filter(s => s.success === true).length || 0;
  const totalSteps = testResult?.steps.length || 0;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-sm max-w-lg w-full border-2 border-border">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {isSuccess ? '✅ Test Passed!' : '❌ Test Failed'}
          </h3>
          
          {testResult && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                {isSuccess ? (
                  <FiCheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <FiXCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={`text-sm font-medium ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                  Status: {testResult.status}
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                Steps: <span className="font-medium">{passedSteps} / {totalSteps}</span> passed
              </p>
              
              {/* Show failed steps if any */}
              {!isSuccess && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded">
                  <p className="text-sm font-medium text-red-300 mb-2">Failed Steps:</p>
                  {testResult.steps
                    .map((step, idx) => ({ step, idx }))
                    .filter(({ step }) => step.success === false)
                    .map(({ step, idx }) => (
                      <div key={idx} className="mb-2">
                        <p className="text-xs font-medium text-red-400">Step {idx + 1}:</p>
                        <p className="text-xs text-red-600 ms-2">{step.error || 'Step failed'}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            {isSuccess ? (
              <>
                <Button variant="secondary" onClick={onReject}>
                  Reject Changes
                </Button>
                <Button onClick={onAccept}>
                  Accept Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={onReject}>
                  Reject
                </Button>
                <Button onClick={onTryAgain}>
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

