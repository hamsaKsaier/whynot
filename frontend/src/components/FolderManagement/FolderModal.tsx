import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import type { UserStoryFolder } from '../../types';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; color: string }) => Promise<void>;
  folder?: UserStoryFolder | null;
  projectId: string;
}

const PRESET_COLORS = [
  '#0284c7', // sky blue dark
  '#0EA5E9', // sky blue
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
];

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folder,
  projectId,
}) => {
  const { t } = useTranslation('dashboard');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0284c7');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color || '#0284c7');
    } else {
      setName('');
      setColor('#0284c7');
    }
    setError(null);
  }, [folder, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('dashboard.folders.nameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), color });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('dashboard.folders.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={folder ? t('dashboard.folders.editTitle') : t('dashboard.folders.createTitle')}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input
            label={t('dashboard.folders.folderName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('dashboard.folders.namePlaceholder')}
            required
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              {t('dashboard.folders.color')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-10 h-10 rounded-lg border-2 transition-colors ${color === presetColor
                      ? 'border-foreground ring-1 ring-primary'
                      : 'border-border hover:border-muted-foreground'
                    }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-8 rounded border border-border cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('dashboard.folders.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {folder ? t('dashboard.folders.updateFolder') : t('dashboard.folders.createFolder')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};






