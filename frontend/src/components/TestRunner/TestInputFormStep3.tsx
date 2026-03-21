import React from 'react';
import { FiGlobe, FiFolder, FiBook, FiPlus, FiTrash2 } from 'react-icons/fi';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ProjectWithStats, UserStoryWithStats } from '../../services/api';
import { PrerequisiteStep, isCreateOrEditFlow } from '../../utils/createEditFlow';

interface TestInputFormStep3Props {
  project: ProjectWithStats | undefined;
  userStory: UserStoryWithStats | undefined;
  websiteUrl: string;
  headless: boolean;
  error?: string;
  onWebsiteUrlChange: (url: string) => void;
  onHeadlessChange: (headless: boolean) => void;
  onGenerateTests: () => void;
  onRunTest: () => void;
  prerequisiteSteps: PrerequisiteStep[];
  onPrerequisiteStepsChange: (steps: PrerequisiteStep[]) => void;
  quickMode: boolean;
  onQuickModeChange: (value: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const TestInputFormStep3: React.FC<TestInputFormStep3Props> = ({
  project,
  userStory,
  websiteUrl,
  headless,
  error,
  onWebsiteUrlChange,
  onHeadlessChange,
  onGenerateTests,
  onRunTest,
  prerequisiteSteps,
  onPrerequisiteStepsChange,
  quickMode,
  onQuickModeChange,
  isLoading = false,
  disabled = false,
}) => {
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="bg-slate-900 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white mb-3">Review Your Selection</h3>

        <div className="flex items-start gap-3">
          <FiFolder className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-slate-400">Project</div>
            <div className="text-sm font-medium text-white">{project?.name || 'Not selected'}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FiBook className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-slate-400">User Story</div>
            <div className="text-sm font-medium text-white">
              {userStory?.story || 'Not selected'}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FiGlobe className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-slate-400">Website URL</div>
            <div className="text-sm font-medium text-white break-all">
              {websiteUrl || 'Not set'}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit: steps to open the form */}
      {isCreateOrEditFlow(userStory?.story ?? '') && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              This looks like a Create or Edit flow. Add the steps to open the creation/edit dialog. We&apos;ll run these first, capture the form, then generate tests.
            </p>
          </div>
          <div className="space-y-2">
            {prerequisiteSteps.map((step, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 p-2 bg-slate-900 rounded border border-slate-700">
                <select
                  value={step.action}
                  onChange={(e) => {
                    const v = e.target.value as 'click' | 'type';
                    onPrerequisiteStepsChange(prerequisiteSteps.map((s, j) => (j === i ? { ...s, action: v } : s)));
                  }}
                  disabled={disabled || isLoading}
                  className="text-sm border border-slate-700 rounded px-2 py-1.5 w-24"
                >
                  <option value="click">Click</option>
                  <option value="type">Type</option>
                </select>
                <input
                  type="text"
                  value={step.selector}
                  onChange={(e) => onPrerequisiteStepsChange(prerequisiteSteps.map((s, j) => (j === i ? { ...s, selector: e.target.value } : s)))}
                  placeholder="e.g. text=Products or button:has-text('Add')"
                  disabled={disabled || isLoading}
                  className="flex-1 min-w-[160px] text-sm border border-slate-700 rounded px-2 py-1.5"
                />
                {step.action === 'type' && (
                  <input
                    type="text"
                    value={step.value ?? ''}
                    onChange={(e) => onPrerequisiteStepsChange(prerequisiteSteps.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))}
                    placeholder="Value"
                    disabled={disabled || isLoading}
                    className="text-sm border border-slate-700 rounded px-2 py-1.5 w-32"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onPrerequisiteStepsChange(prerequisiteSteps.filter((_, j) => j !== i))}
                  disabled={disabled || isLoading}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  aria-label="Remove step"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onPrerequisiteStepsChange([...prerequisiteSteps, { action: 'click', selector: '' }])}
              disabled={disabled || isLoading}
            >
              <FiPlus className="h-4 w-4 mr-1 inline" />
              Add step
            </Button>
          </div>
        </div>
      )}

      {/* Configuration Section */}
      <div className="space-y-4">
        <Input
          label="Website URL"
          type="url"
          placeholder="https://example.com"
          value={websiteUrl}
          onChange={(e) => onWebsiteUrlChange(e.target.value)}
          error={error}
          disabled={disabled || isLoading}
          required
        />

        <div className="flex items-center">
          <input
            type="checkbox"
            id="headless"
            checked={headless}
            onChange={(e) => onHeadlessChange(e.target.checked)}
            disabled={disabled || isLoading}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-700 rounded"
          />
          <label htmlFor="headless" className="ml-2 text-sm text-slate-200">
            Run in headless mode (no live preview)
          </label>
        </div>
      </div>

      {/* Coverage option: Quick vs Full */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-200">Test coverage</span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="coverage"
              checked={!quickMode}
              onChange={() => onQuickModeChange(false)}
              disabled={disabled || isLoading}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-200">Full coverage (all scenarios, ~1 min)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="coverage"
              checked={quickMode}
              onChange={() => onQuickModeChange(true)}
              disabled={disabled || isLoading}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-200">Quick (1 test, ~20s)</span>
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Quick generates one happy-path test; Full generates positive, negative, and edge scenarios.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
        <Button
          onClick={onGenerateTests}
          disabled={disabled || isLoading || !isValidUrl(websiteUrl)}
          variant="secondary"
        >
          Generate Tests
        </Button>
        <Button
          onClick={onRunTest}
          disabled={disabled || isLoading || !isValidUrl(websiteUrl)}
          isLoading={isLoading}
        >
          Run Test
        </Button>
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <p>
          <strong>Generate Tests:</strong> Creates test cases from your user story without executing them.
        </p>
        <p>
          <strong>Run Test:</strong> Generates test cases and immediately executes them.
        </p>
      </div>
    </div>
  );
};
