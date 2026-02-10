import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../common/ToastContainer';
import { useToastContext } from '../../contexts/ToastContext';

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
  const { toasts, dismissToast } = useToastContext();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
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
          <main id="main-content" className={`flex-1 overflow-y-auto ${showBrowserPreview ? 'border-r border-gray-200' : ''}`} role="main">
            <div className="p-6">
              {children}
            </div>
          </main>

          {/* Browser Preview Pane (Right) */}
          {showBrowserPreview && browserPreview && (
            <div className="w-1/2 border-l border-gray-200 bg-white overflow-hidden">
              {browserPreview}
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

























