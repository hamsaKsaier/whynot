import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  showBrowserPreview?: boolean;
  browserPreview?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  showBrowserPreview = false,
  browserPreview 
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content Pane */}
          <div className={`flex-1 overflow-y-auto ${showBrowserPreview ? 'border-r border-gray-200' : ''}`}>
            <div className="p-6">
              {children}
            </div>
          </div>

          {/* Browser Preview Pane (Right) */}
          {showBrowserPreview && browserPreview && (
            <div className="w-1/2 border-l border-gray-200 bg-white overflow-hidden">
              {browserPreview}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

























