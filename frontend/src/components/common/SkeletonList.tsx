import React from 'react';
import { SkeletonLoader } from './SkeletonLoader';

interface SkeletonListProps {
  count?: number;
  className?: string;
  showAvatar?: boolean;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  className = '',
  showAvatar = false,
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          {showAvatar && (
            <SkeletonLoader width="w-10" height="h-10" circle={true} />
          )}
          <div className="flex-1 space-y-2">
            <SkeletonLoader width="w-3/4" height="h-4" />
            <SkeletonLoader width="w-1/2" height="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
};
