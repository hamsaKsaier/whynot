import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FiBell, FiSettings, FiHelpCircle, FiLogOut } from 'react-icons/fi';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';

export const Header: React.FC = () => {
  const location = useLocation();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { user, logout } = useAuth();

  /** Get up-to-two-letter initials from the user's name */
  const initials = user
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?';

  useKeyboardShortcut('/', () => setShortcutsOpen(true), { metaKey: true, ctrlKey: true });

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Projects', path: '/' }];
    
    if (paths.length === 0) {
      return [{ label: 'Dashboard', path: '/' }];
    }

    const pathMap: { [key: string]: string } = {
      'test-cases': 'Test Cases',
      'test-runs': 'Test Runs',
      'environments': 'Environments',
      'settings': 'Settings',
      'personas': 'Personas',
      'execute': 'Execute Test',
    };

    paths.forEach((path, index) => {
      const label = pathMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
      const fullPath = '/' + paths.slice(0, index + 1).join('/');
      breadcrumbs.push({ label, path: fullPath });
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6" role="banner">
      {/* Left: WorkspaceSwitcher + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher />
        <span className="text-gray-300">|</span>
        <div className="flex items-center space-x-1 text-sm text-gray-600">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <span className="text-gray-400">/</span>}
              <Link
                to={crumb.path}
                className={`hover:text-gray-900 transition-colors ${
                  index === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''
                }`}
              >
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center space-x-4">
        {/* Keyboard Shortcuts */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (Cmd/Ctrl + /)"
        >
          <FiHelpCircle className="h-5 w-5 text-gray-600" />
        </button>

        {/* Upgrade Button */}
        <button className="px-4 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
          Upgrade
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
          <FiBell className="h-5 w-5 text-gray-600" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <FiSettings className="h-5 w-5 text-gray-600" />
        </button>

        {/* User Avatar + Logout */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                {initials}
              </div>
            )}
            {user && (
              <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
                {user.name}
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <FiLogOut className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  );
};

























