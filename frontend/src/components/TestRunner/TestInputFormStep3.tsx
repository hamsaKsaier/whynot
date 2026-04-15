import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');

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
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('runner.step3.reviewSelection')}</h3>

        <div className="flex items-start gap-3">
          <FiFolder className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{t('runner.step3.project')}</div>
            <div className="text-sm font-medium text-foreground">{project?.name || t('runner.step3.notSelected')}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FiBook className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{t('runner.step3.userStory')}</div>
            <div className="text-sm font-medium text-foreground">
              {userStory?.story || t('runner.step3.notSelected')}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FiGlobe className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{t('runner.step3.websiteUrl')}</div>
            <div className="text-sm font-medium text-foreground break-all">
              {websiteUrl || t('runner.step3.notSet')}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit: steps to open the form */}
      {isCreateOrEditFlow(userStory?.story ?? '') && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              {t('runner.step3.createEditFlowHint')}
            </p>
          </div>
          <div className="space-y-2">
            {prerequisiteSteps.map((step, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 p-2 bg-muted rounded border border-border">
                <select
                  value={step.action}
                  onChange={(e) => {
                    const v = e.target.value as 'click' | 'type';
                    onPrerequisiteStepsChange(prerequisiteSteps.map((s, j) => (j === i ? { ...s, action: v } : s)));
                  }}
                  disabled={disabled || isLoading}
                  className="text-sm border border-border rounded px-2 py-1.5 w-24"
                >
                  <option value="click">{t('runner.step3.actionClick')}</option>
                  <option value="type">{t('runner.step3.actionType')}</option>
                </select>
                <input
                  type="text"
                  value={step.selector}
                  onChange={(e) => onPrerequisiteStepsChange(prerequisiteSteps.map((s, j) => (j === i ? { ...s, selector: e.target.value } : s)))}
                  placeholder="e.g. text=Products or button:has-text('Add')"
                  disabled={disabled || isLoading}
                  className="flex-1 min-w-[160px] text-sm border border-border rounded px-2 py-1.5"
                />
                {step.action === 'type' && (
                  <input
                    type="text"
                    value={step.value ?? ''}
                    onChange={(e) => onPrerequisiteStepsChange(prerequisiteSteps.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))}
                    placeholder={t('runner.generation.value')}
                    disabled={disabled || isLoading}
                    className="text-sm border border-border rounded px-2 py-1.5 w-32"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onPrerequisiteStepsChange(prerequisiteSteps.filter((_, j) => j !== i))}
                  disabled={disabled || isLoading}
                  className="p-1.5 text-red-600 hover:bg-red-900/20 rounded"
                  aria-label={t('runner.steps.remove')}
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
              <FiPlus className="h-4 w-4 me-1 inline" />
              {t('runner.steps.add')}
            </Button>
          </div>
        </div>
      )}

      {/* Configuration Section */}
      <div className="space-y-4">
        <Input
          label={t('runner.step3.websiteUrl')}
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
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-border rounded"
          />
          <label htmlFor="headless" className="ms-2 text-sm text-foreground">
            {t('runner.step3.headlessMode')}
          </label>
        </div>
      </div>

      {/* Coverage option: Quick vs Full */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">{t('runner.step3.testCoverage')}</span>
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
            <span className="text-sm text-foreground">{t('runner.step3.fullCoverage')}</span>
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
            <span className="text-sm text-foreground">{t('runner.step3.quickCoverage')}</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('runner.step3.coverageDescription')}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <Button
          onClick={onGenerateTests}
          disabled={disabled || isLoading || !isValidUrl(websiteUrl)}
          variant="secondary"
        >
          {t('runner.generateTests')}
        </Button>
        <Button
          onClick={onRunTest}
          disabled={disabled || isLoading || !isValidUrl(websiteUrl)}
          isLoading={isLoading}
        >
          {t('runner.runTest')}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>{t('runner.generateTests')}:</strong> {t('runner.step3.generateTestsDesc')}
        </p>
        <p>
          <strong>{t('runner.runTest')}:</strong> {t('runner.step3.runTestDesc')}
        </p>
      </div>
    </div>
  );
};
