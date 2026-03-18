import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconType } from 'react-icons';
import {
  FiHome,
  FiFolder,
  FiChevronLeft,
  FiChevronRight,
  FiZap,
  FiClipboard,
  FiSettings,
  FiLogOut,
} from 'react-icons/fi';
import { Tooltip } from '../common/Tooltip';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NavItem {
  icon: IconType;
  label: string;
  path: string;
  badge?: number | string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onMobileClose?: () => void;
}

// ─── Navigation Data ────────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
  {
    label: 'MAIN',
    items: [
      { icon: FiZap, label: 'QA Loop', path: '/qa-loop' },
      { icon: FiHome, label: 'Dashboard', path: '/' },
    ],
  },
  {
    label: 'WORKSPACE',
    items: [
      { icon: FiFolder, label: 'Projects', path: '/projects' },
      { icon: FiClipboard, label: 'Test Results', path: '/test-results' },
    ],
  },
];

const bottomItems: NavItem[] = [
  { icon: FiSettings, label: 'Settings', path: '/settings' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  onMobileClose,
}) => {
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // ── Render a single nav item ──────────────────────────────────────────────

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    const linkContent = (
      <Link
        key={item.path}
        to={item.path}
        onClick={onMobileClose}
        className={`flex items-center rounded-lg transition-all duration-200 ${
          collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
        } ${
          active
            ? 'bg-primary-600 text-white font-medium shadow-sm'
            : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
        }`}
      >
        <Icon
          className={`h-5 w-5 flex-shrink-0 ${collapsed ? '' : 'mr-3'} ${
            active ? 'text-white' : 'text-gray-500'
          }`}
        />
        {!collapsed && <span className="flex-1 text-sm">{item.label}</span>}
        {!collapsed && item.badge !== undefined && (
          <span className="ml-auto text-[11px] font-medium bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 min-w-[20px] text-center">
            {item.badge}
          </span>
        )}
      </Link>
    );

    return collapsed ? (
      <Tooltip key={item.path} content={item.label} position="right">
        {linkContent}
      </Tooltip>
    ) : (
      <React.Fragment key={item.path}>{linkContent}</React.Fragment>
    );
  };

  // ── Render a nav group with card wrapper ──────────────────────────────────

  const renderNavGroup = (group: NavGroup) => (
    <div
      key={group.label}
      className={`rounded-xl bg-gray-50/70 ${
        collapsed ? 'mx-1 mb-3 p-1' : 'mx-2 mb-3 p-1.5'
      }`}
    >
      {!collapsed && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
          {group.label}
        </p>
      )}
      <div className="space-y-0.5">{group.items.map(renderNavItem)}</div>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div
      className={`h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className={`flex border-b border-gray-100 ${
          collapsed
            ? 'h-[72px] flex-col items-center justify-center px-2 gap-0.5'
            : 'h-[72px] items-center justify-between px-4'
        }`}
      >
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FiZap className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                WhyNot
              </p>
              <p className="text-xs text-gray-500 leading-tight truncate">
                {activeWorkspace?.name || 'QA Platform'}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-9 w-9 rounded-lg bg-primary-50 flex items-center justify-center">
            <FiZap className="h-5 w-5 text-primary-600" />
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 ${
            collapsed ? 'mx-auto mt-1' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight className="h-4 w-4 text-gray-400" />
          ) : (
            <FiChevronLeft className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* ── Grouped Navigation ─────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto pt-4 pb-2"
        role="navigation"
        aria-label="Main navigation"
      >
        {navGroups.map(renderNavGroup)}
      </nav>

      {/* ── User Profile ───────────────────────────────────────────────── */}
      {user && (
        <div className={`${collapsed ? 'px-1 pb-2' : 'px-2 pb-2'}`}>
          {collapsed ? (
            <Tooltip content={user.name || 'User'} position="right">
              <div className="mx-auto h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold cursor-default">
                {initials}
              </div>
            </Tooltip>
          ) : (
            <div className="mx-0 rounded-xl bg-gray-50/70 p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate capitalize">
                    {user.role?.replace(/_/g, ' ') || 'User'}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-md hover:bg-gray-200 transition-colors flex-shrink-0"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <FiLogOut className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Settings ───────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 py-2 px-2">
        {bottomItems.map(renderNavItem)}
      </div>
    </div>
  );
};
