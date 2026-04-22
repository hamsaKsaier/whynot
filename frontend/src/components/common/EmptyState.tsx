import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  tip?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: {
    icon: 'h-8 w-8',
    title: 'text-base',
    description: 'text-xs',
    padding: 'py-8',
  },
  md: {
    icon: 'h-12 w-12',
    title: 'text-lg',
    description: 'text-sm',
    padding: 'py-12',
  },
  lg: {
    icon: 'h-16 w-16',
    title: 'text-xl',
    description: 'text-base',
    padding: 'py-16',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  tip,
  className = '',
  size = 'md',
}) => {
  const config = sizeConfig[size];

  return (
    <div className={`text-center ${config.padding} ${className}`}>
      <div className="flex justify-center mb-4">
        <div className={`${config.icon} text-muted-foreground flex items-center justify-center`}>
          {icon != null && typeof icon === 'object' && 'type' in icon ? (
            React.cloneElement(icon as React.ReactElement, {
              className: `${config.icon} text-muted-foreground`,
            })
          ) : (
            icon
          )}
        </div>
      </div>
      <h3 className={`mt-2 ${config.title} font-semibold text-foreground`}>{title}</h3>
      <p className={`mt-2 ${config.description} text-muted-foreground max-w-md mx-auto leading-relaxed`}>
        {description}
      </p>
      {tip && (
        <div className="mt-4 max-w-md mx-auto">
          <p className={`${config.description} text-muted-foreground italic bg-muted rounded-lg px-4 py-2 inline-block`}>
            💡 {tip}
          </p>
        </div>
      )}
      {action && (
        <div className="mt-8">
          {action}
        </div>
      )}
    </div>
  );
};
