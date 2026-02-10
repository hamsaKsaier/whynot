import React from 'react';
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
  const navigate = useNavigate();

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.name}${p.user_story_count ? ` (${p.user_story_count} stories)` : ''}`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Project <span className="text-red-500">*</span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/projects')}
            className="text-xs"
          >
            <FiFolder className="mr-1 h-3 w-3" />
            Manage Projects
          </Button>
        </div>
        <Select
          options={projectOptions}
          value={selectedProjectId}
          onChange={onProjectChange}
          placeholder={loadingProjects ? 'Loading projects...' : 'Select a project'}
          error={error}
          disabled={disabled || loadingProjects}
        />
        {projects.length === 0 && !loadingProjects && (
          <p className="mt-1 text-sm text-gray-500">
            No projects found.{' '}
            <button
              onClick={() => navigate('/projects')}
              className="text-primary-600 hover:underline"
            >
              Create one
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
