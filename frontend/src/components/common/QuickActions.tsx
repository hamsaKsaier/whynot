import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiMoreVertical, FiEdit, FiTrash2, FiCopy, FiShare2 } from 'react-icons/fi';

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
  trigger?: React.ReactNode;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  trigger,
  position = 'bottom-right',
  className = '',
}) => {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    if (isOpen && containerRef.current && menuRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = 0;
      let left = 0;

      // Calculate position based on prop
      switch (position) {
        case 'bottom-right':
          top = containerRect.bottom + 4;
          left = containerRect.right - menuRect.width;
          break;
        case 'bottom-left':
          top = containerRect.bottom + 4;
          left = containerRect.left;
          break;
        case 'top-right':
          top = containerRect.top - menuRect.height - 4;
          left = containerRect.right - menuRect.width;
          break;
        case 'top-left':
          top = containerRect.top - menuRect.height - 4;
          left = containerRect.left;
          break;
      }

      // Adjust if menu goes off screen
      if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width - 8;
      }
      if (left < 8) {
        left = 8;
      }
      if (top + menuRect.height > viewportHeight) {
        top = containerRect.top - menuRect.height - 4;
      }
      if (top < 8) {
        top = 8;
      }

      setMenuPosition({ top, left });
    }
  }, [isOpen, position]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < actions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : actions.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!actions[index].disabled) {
        actions[index].onClick();
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
  };

  const handleActionClick = (action: QuickAction) => {
    if (!action.disabled) {
      action.onClick();
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const enabledActions = actions.filter((a) => !a.disabled);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={t('common.aria.moreActions')}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger || <FiMoreVertical className="h-4 w-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <>
          <div
            ref={menuRef}
            className="absolute z-50 mt-1 w-48 bg-popover rounded-lg shadow-sm border border-border py-1"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
            role="menu"
            aria-orientation="vertical"
          >
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(action);
                }}
                onKeyDown={(e) => handleKeyDown(e, index)}
                disabled={action.disabled}
                className={`
                  w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors
                  ${action.disabled
                    ? 'text-muted-foreground cursor-not-allowed'
                    : action.variant === 'danger'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-popover-foreground hover:bg-muted'
                  }
                  ${focusedIndex === index ? 'bg-muted' : ''}
                `}
                role="menuitem"
                tabIndex={action.disabled ? -1 : 0}
              >
                <span className="flex-shrink-0">{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
