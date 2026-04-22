import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiBook } from 'react-icons/fi';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { Textarea } from '../common/Textarea';
import { Modal, ModalFooter } from '../common/Modal';
import { UserStoryWithStats } from '../../services/api';

interface TestInputFormStep2Props {
  userStories: UserStoryWithStats[];
  selectedUserStoryId: string;
  loadingUserStories: boolean;
  error?: string;
  onUserStoryChange: (userStoryId: string) => void;
  onCreateUserStory: (story: string, context?: string) => Promise<void>;
  disabled?: boolean;
}

export const TestInputFormStep2: React.FC<TestInputFormStep2Props> = ({
  userStories,
  selectedUserStoryId,
  loadingUserStories,
  error,
  onUserStoryChange,
  onCreateUserStory,
  disabled = false,
}) => {
  const { t } = useTranslation('runner');
  const [isNewUserStoryModalOpen, setIsNewUserStoryModalOpen] = useState(false);
  const [newUserStoryText, setNewUserStoryText] = useState('');
  const [newUserStoryContext, setNewUserStoryContext] = useState('');
  const [creatingUserStory, setCreatingUserStory] = useState(false);

  const userStoryOptions = userStories.map((us) => ({
    value: us.id,
    label: us.story.length > 80 ? `${us.story.substring(0, 80)}...` : us.story,
  }));

  const getSelectedUserStoryText = (): string => {
    const userStory = userStories.find((us) => us.id === selectedUserStoryId);
    return userStory?.story || '';
  };

  const handleCreateUserStory = async () => {
    if (!newUserStoryText.trim()) return;

    setCreatingUserStory(true);
    try {
      await onCreateUserStory(newUserStoryText.trim(), newUserStoryContext.trim() || undefined);
      setIsNewUserStoryModalOpen(false);
      setNewUserStoryText('');
      setNewUserStoryContext('');
    } catch (error) {
      console.error('Failed to create user story:', error);
    } finally {
      setCreatingUserStory(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-200">
              {t('runner.step2.userStory')} <span className="text-red-500">*</span>
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsNewUserStoryModalOpen(true)}
              className="text-xs"
              disabled={disabled}
            >
              <FiPlus className="me-1 h-3 w-3" />
              {t('runner.step2.newStory')}
            </Button>
          </div>
          <Select
            options={userStoryOptions}
            value={selectedUserStoryId}
            onChange={onUserStoryChange}
            placeholder={
              loadingUserStories
                ? t('runner.step2.loadingStories')
                : t('runner.step2.selectStory')
            }
            error={error}
            disabled={disabled || loadingUserStories}
          />
          {userStories.length === 0 && !loadingUserStories && (
            <p className="mt-1 text-sm text-slate-400">
              {t('runner.step2.noStories')}{' '}
              <button
                onClick={() => setIsNewUserStoryModalOpen(true)}
                className="text-primary-600 hover:underline"
              >
                {t('runner.step2.addOne')}
              </button>
            </p>
          )}
        </div>

        {/* Selected User Story Preview */}
        {selectedUserStoryId && (
          <div className="p-3 bg-green-900/20 border border-green-800 rounded-lg">
            <div className="flex items-start gap-2">
              <FiBook className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-400">{getSelectedUserStoryText()}</p>
            </div>
          </div>
        )}
      </div>

      {/* New User Story Modal */}
      <Modal
        isOpen={isNewUserStoryModalOpen}
        onClose={() => setIsNewUserStoryModalOpen(false)}
        title={t('runner.step2.addUserStory')}
        size="lg"
      >
        <div className="space-y-4">
          <Textarea
            label={t('runner.step2.userStory')}
            placeholder={t('runner.step2.storyPlaceholder')}
            value={newUserStoryText}
            onChange={(e) => setNewUserStoryText(e.target.value)}
            rows={4}
            required
          />
          <Textarea
            label={t('runner.step2.additionalContext')}
            placeholder={t('runner.step2.contextPlaceholder')}
            value={newUserStoryContext}
            onChange={(e) => setNewUserStoryContext(e.target.value)}
            rows={2}
          />
        </div>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setIsNewUserStoryModalOpen(false)}
            disabled={creatingUserStory}
          >
            {t('runner.step2.cancel')}
          </Button>
          <Button
            onClick={handleCreateUserStory}
            isLoading={creatingUserStory}
            disabled={!newUserStoryText.trim()}
          >
            {t('runner.step2.addUserStory')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
