import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiFolder,
  FiFileText,
  FiPlay,
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
  FiZap,
  FiServer,
  FiUsers,
  FiGitBranch,
  FiKey
} from 'react-icons/fi';
import { Tooltip } from '../common/Tooltip';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse
}) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    onToggleCollapse?.();
  };

  const primaryMenuItems = [
    {
      icon: FiHome,
      label: 'Dashboard',
      path: '/',
      badge: null
    },
    {
      icon: FiZap,
      label: 'QA Loop',
      path: '/qa-loop',
      badge: 'NEW'
    },
    {
      icon: FiFolder,
      label: 'Projects',
      path: '/projects',
      badge: null
    },
    {
      icon: FiPlay,
      label: 'Test Runs',
      path: '/test-runs',
      badge: null
    },
  ];

  const secondaryMenuItems = [
    {
      icon: FiFileText,
      label: 'Test Cases',
      path: '/test-cases',
      badge: null
    },
    {
      icon: FiServer,
      label: 'Environments',
      path: '/environments',
      badge: null
    },
    {
      icon: FiKey,
      label: 'Webhooks',
      path: '/webhooks',
      badge: null
    },
    {
      icon: FiSettings,
      label: 'Settings',
      path: '/settings',
      badge: null
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'
        }`}
    >
      {/* Logo/Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center">
            <FiZap className="h-6 w-6 text-primary-600 mr-2" />
            <span className="font-bold text-gray-900">WhyNot</span>
          </div>
        )}
        {isCollapsed && (
          <FiZap className="h-6 w-6 text-primary-600 mx-auto" />
        )}
        <button
          onClick={toggleCollapse}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <FiChevronRight className="h-5 w-5 text-gray-600" />
          ) : (
            <FiChevronLeft className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Project Section */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Project
          </div>
          <div className="text-sm font-medium text-gray-900">
            WhyNot
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-4" role="navigation" aria-label="Main navigation">
        <div className="px-2 space-y-4">
          {/* Primary Section */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Primary
                </span>
              </div>
            )}
            <div className="space-y-1">
              {primaryMenuItems.map((item) => {
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
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );

                return isCollapsed ? (
                  <Tooltip key={item.path} content={item.label} position="right">
                    {linkContent}
                  </Tooltip>
                ) : (
                  linkContent
                );
              })}
            </div>
          </div>

          {/* Secondary Section */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Secondary
                </span>
              </div>
            )}
            <div className="space-y-1">
              {secondaryMenuItems.map((item) => {
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
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );

                return isCollapsed ? (
                  <Tooltip key={item.path} content={item.label} position="right">
                    {linkContent}
                  </Tooltip>
                ) : (
                  linkContent
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Workspace
          </div>
          <Link
            to="/organization-settings"
            className="flex items-center text-sm text-gray-700 hover:text-gray-900"
          >
            <FiSettings className="h-4 w-4 mr-2" />
            Organization Settings
          </Link>
        </div>
      )}
    </div>
  );
};

















