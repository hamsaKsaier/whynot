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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, dismissToast } = useToastContext();

  return (
    <div className="min-h-screen flex flex-col bg-navy-900 text-slate-200">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      {/* Header */}
      <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar — drawer on mobile, static on desktop */}
        <div
          className={`
            fixed lg:static inset-y-0 left-0 z-30
            transform transition-transform duration-300
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Main Content Pane */}
          <main id="main-content" className={`flex-1 overflow-y-auto ${showBrowserPreview ? 'border-r border-navy-700' : ''}`} role="main">
            <div className="p-4 sm:p-6">
              {children}
            </div>
          </main>

          {/* Browser Preview Pane (Right) */}
          {showBrowserPreview && browserPreview && (
            <div className="w-1/2 border-l border-navy-700 bg-navy-800 overflow-hidden hidden md:block">
              {browserPreview}
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

























