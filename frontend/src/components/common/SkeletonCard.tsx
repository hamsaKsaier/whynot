import React from 'react';
import { SkeletonLoader } from './SkeletonLoader';

interface SkeletonCardProps {
  count?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  count = 1,
  className = '',
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`bg-card rounded-lg shadow-sm p-6 border border-border ${className}`}
        >
          <SkeletonLoader width="w-3/4" height="h-6" className="mb-4" />
          <SkeletonLoader width="w-full" height="h-4" className="mb-2" />
          <SkeletonLoader width="w-5/6" height="h-4" className="mb-4" />
          <div className="flex items-center gap-2 mt-4">
            <SkeletonLoader width="w-16" height="h-8" circle={false} />
            <SkeletonLoader width="w-16" height="h-8" circle={false} />
          </div>
        </div>
      ))}
    </>
  );
};
