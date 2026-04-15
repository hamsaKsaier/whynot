import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');

  const tabs: Array<{
    id: ExecutionViewTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'steps', label: t('runner.execution.stepsTab', { defaultValue: 'Steps' }), icon: <FiList className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> },
    { id: 'details', label: t('runner.execution.detailsTab', { defaultValue: 'Details' }), icon: <FiFileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> },
    ...(hasPreview ? [{ id: 'preview' as ExecutionViewTab, label: t('runner.execution.previewTab', { defaultValue: 'Preview' }), icon: <FiMonitor className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> }] : []),
    { id: 'activity', label: t('runner.execution.activityTab', { defaultValue: 'Activity' }), icon: <FiActivity className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> },
  ];

  return (
    <div className={`border-b border-border bg-card ${className}`}>
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors duration-150 min-h-[44px]
                ${isActive
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
                whitespace-nowrap flex-1 justify-center sm:flex-initial sm:justify-start
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
