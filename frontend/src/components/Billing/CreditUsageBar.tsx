import React from 'react';

interface CreditUsageBarProps {
  used: number;
  total: number;
  remaining: number;
}

export const CreditUsageBar: React.FC<CreditUsageBarProps> = ({ used, total, remaining }) => {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{used} used</span>
        <span>{remaining} remaining</span>
      </div>
    </div>
  );
};
