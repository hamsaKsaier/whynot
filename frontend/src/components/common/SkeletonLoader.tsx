import React from 'react';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  count?: number;
  circle?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
  count = 1,
  circle = false,
}) => {
  const baseClasses = 'bg-gray-200 rounded animate-pulse';
  const shapeClasses = circle ? 'rounded-full' : 'rounded';
  
  const skeletonItems = Array.from({ length: count }).map((_, index) => (
    <div
      key={index}
      className={`${baseClasses} ${shapeClasses} ${width} ${height} ${className}`}
      style={{
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  ));

  return (
    <>
      {skeletonItems}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </>
  );
};
