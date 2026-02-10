import React from 'react';
import { FiList, FiFileText, FiMonitor, FiActivity } from 'react-icons/fi';

export type ExecutionViewTab = 'steps' | 'details' | 'preview' | 'activity';

interface ExecutionViewTabsProps {
  activeTab: ExecutionViewTab;
  onTabChange: (tab: ExecutionViewTab) => void;
  hasPreview: boolean;
  className?: string;
}

export const ExecutionViewTabs: React.FC<ExecutionViewTabsProps> = ({
  activeTab,
  onTabChange,
  hasPreview,
  className = '',
}) => {
  const tabs: Array<{
    id: ExecutionViewTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'steps', label: 'Steps', icon: <FiList className="h-4 w-4" /> },
    { id: 'details', label: 'Details', icon: <FiFileText className="h-4 w-4" /> },
    ...(hasPreview ? [{ id: 'preview' as ExecutionViewTab, label: 'Preview', icon: <FiMonitor className="h-4 w-4" /> }] : []),
    { id: 'activity', label: 'Activity', icon: <FiActivity className="h-4 w-4" /> },
  ];

  return (
    <div className={`border-b border-gray-200 bg-white ${className}`}>
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
                whitespace-nowrap
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
