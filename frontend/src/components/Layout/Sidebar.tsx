import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiFolder,
  FiChevronLeft,
  FiChevronRight,
  FiZap,
  FiClipboard,
  FiSettings,
} from 'react-icons/fi';
import { Tooltip } from '../common/Tooltip';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  onMobileClose,
}) => {
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();

  const toggleCollapse = () => {
    onToggleCollapse?.();
  };

  const navItems = [
    { icon: FiZap,       label: 'QA Loop',       path: '/qa-loop' },
    { icon: FiHome,      label: 'Dashboard',     path: '/' },
    { icon: FiFolder,    label: 'Projects',      path: '/projects' },
    { icon: FiClipboard, label: 'Test Results',  path: '/test-results' },
  ];

  const bottomItems = [
    { icon: FiSettings, label: 'Settings', path: '/settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderNavItem = (item: typeof navItems[0]) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    const linkContent = (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center px-3 py-2 rounded-lg transition-colors group ${active
          ? 'bg-primary-500/10 text-primary-400 font-medium'
          : 'text-slate-500 hover:bg-navy-700 hover:text-slate-300'
          }`}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
        {!collapsed && (
          <span className="flex-1">{item.label}</span>
        )}
      </Link>
    );

    return collapsed ? (
      <Tooltip key={item.path} content={item.label} position="right">
        {linkContent}
      </Tooltip>
    ) : (
      linkContent
    );
  };

  return (
    <div
      className={`bg-navy-900 border-r border-navy-700 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'
        }`}
    >
      {/* Logo/Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-navy-700">
        {!collapsed && (
          <div className="flex items-center">
            <img src="/logo.svg" alt="WhyNot" className="h-6" />
          </div>
        )}
        {collapsed && (
          <img src="/favicon.svg" alt="WhyNot" className="h-6 w-6 mx-auto" />
        )}
        <button
          onClick={toggleCollapse}
          className="p-1 rounded hover:bg-navy-700 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight className="h-5 w-5 text-slate-500" />
          ) : (
            <FiChevronLeft className="h-5 w-5 text-slate-500" />
          )}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-4" role="navigation" aria-label="Main navigation" onClick={onMobileClose}>
        <div className="px-2 space-y-1">
          {navItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Bottom: Settings */}
      <div className="border-t border-navy-700 py-3 px-2" onClick={onMobileClose}>
        {bottomItems.map(renderNavItem)}
      </div>
    </div>
  );
};
