import React from 'react';
import { Modal } from './Modal';
import { FiX } from 'react-icons/fi';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  {
    keys: ['Cmd', '/'],
    description: 'Show keyboard shortcuts',
    category: 'General',
  },
  {
    keys: ['Cmd', 'N'],
    description: 'Create new (context-aware)',
    category: 'General',
  },
  {
    keys: ['Escape'],
    description: 'Close modals/dialogs',
    category: 'General',
  },
  {
    keys: ['Enter'],
    description: 'Submit forms',
    category: 'Forms',
  },
  {
    keys: ['Cmd', 'Enter'],
    description: 'Run test (when in test form)',
    category: 'Test Execution',
  },
];

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const formatKey = (key: string) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (key === 'Cmd') {
      return isMac ? '⌘' : 'Ctrl';
    }
    return key;
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="space-y-6">
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-foreground mb-3">{category}</h3>
            <div className="space-y-2">
              {categoryShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="text-sm text-foreground">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <React.Fragment key={keyIndex}>
                        <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                          {formatKey(key)}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-muted-foreground mx-1">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Note: On Windows/Linux, use Ctrl instead of Cmd
        </p>
      </div>
    </Modal>
  );
};
