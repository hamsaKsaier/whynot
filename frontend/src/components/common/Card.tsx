import React from 'react';

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
  const baseClasses = 'bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 transition-all duration-200';
  const hoverClasses = hoverable || clickable
    ? 'hover:shadow-md hover:border-primary-200 hover:scale-[1.01]'
    : '';
  const clickableClasses = clickable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`}
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
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
          {title && (
            <h3 className="text-lg font-semibold text-white">{title}</h3>
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





























