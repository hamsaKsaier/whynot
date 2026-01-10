import React, { useState, useEffect } from 'react';
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
  '#6366f1', // indigo
  '#8b5cf6', // purple
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
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color || '#6366f1');
    } else {
      setName('');
      setColor('#6366f1');
    }
    setError(null);
  }, [folder, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), color });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={folder ? 'Edit Folder' : 'Create Folder'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Folder Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Authentication, Checkout, Dashboard"
            required
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${color === presetColor
                      ? 'border-gray-900 scale-110 shadow-md'
                      : 'border-gray-300 hover:border-gray-400'
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
                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-600">{color}</span>
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
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {folder ? 'Update' : 'Create'} Folder
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};






