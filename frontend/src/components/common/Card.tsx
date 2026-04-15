import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  hoverable?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  className = '',
  headerActions,
  hoverable = false,
  clickable = false,
  onClick,
}) => {
  const baseClasses = 'bg-card rounded-lg shadow-sm border border-border p-6 transition-colors duration-150';
  const hoverClasses = hoverable || clickable
    ? 'hover:bg-muted/50'
    : '';
  const clickableClasses = clickable ? 'cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary' : '';

  return (
    <div
      className={cn(baseClasses, hoverClasses, clickableClasses, className)}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable && onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {(title || headerActions) && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          {title && (
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          )}
          {headerActions && (
            <div>{headerActions}</div>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};





























