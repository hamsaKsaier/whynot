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
          ? 'bg-primary-50 text-primary-700 font-medium'
          : 'text-gray-700 hover:bg-gray-50'
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
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'
        }`}
    >
      {/* Logo/Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center">
            <FiZap className="h-6 w-6 text-primary-600 mr-2" />
            <span className="font-bold text-gray-900">{activeWorkspace?.name || 'WhyNot'}</span>
          </div>
        )}
        {collapsed && (
          <FiZap className="h-6 w-6 text-primary-600 mx-auto" />
        )}
        <button
          onClick={toggleCollapse}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight className="h-5 w-5 text-gray-600" />
          ) : (
            <FiChevronLeft className="h-5 w-5 text-gray-600" />
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
      <div className="border-t border-gray-200 py-3 px-2" onClick={onMobileClose}>
        {bottomItems.map(renderNavItem)}
      </div>
    </div>
  );
};
