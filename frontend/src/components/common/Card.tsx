import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  className = '',
  headerActions,
}) => {
  return (
    <div className={`card ${className}`}>
      {(title || headerActions) && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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





























