import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FiFolder } from 'react-icons/fi';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { ProjectWithStats } from '../../services/api';

interface TestInputFormStep1Props {
  projects: ProjectWithStats[];
  selectedProjectId: string;
  loadingProjects: boolean;
  error?: string;
  onProjectChange: (projectId: string) => void;
  disabled?: boolean;
}

export const TestInputFormStep1: React.FC<TestInputFormStep1Props> = ({
  projects,
  selectedProjectId,
  loadingProjects,
  error,
  onProjectChange,
  disabled = false,
}) => {
  const { t } = useTranslation('runner');
  const navigate = useNavigate();

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.name}${p.user_story_count ? ` (${p.user_story_count} ${t('runner.step1.stories')})` : ''}`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-slate-200">
            {t('runner.step1.project')} <span className="text-red-500">*</span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/projects')}
            className="text-xs"
          >
            <FiFolder className="me-1 h-3 w-3" />
            {t('runner.step1.manageProjects')}
          </Button>
        </div>
        <Select
          options={projectOptions}
          value={selectedProjectId}
          onChange={onProjectChange}
          placeholder={loadingProjects ? t('runner.step1.loadingProjects') : t('runner.step1.selectProject')}
          error={error}
          disabled={disabled || loadingProjects}
        />
        {projects.length === 0 && !loadingProjects && (
          <p className="mt-1 text-sm text-slate-400">
            {t('runner.step1.noProjects')}{' '}
            <button
              onClick={() => navigate('/projects')}
              className="text-primary-600 hover:underline"
            >
              {t('runner.step1.createOne')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
