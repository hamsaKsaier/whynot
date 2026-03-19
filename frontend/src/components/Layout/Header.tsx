import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FiHelpCircle, FiLogOut, FiMenu, FiX, FiZap, FiFolder, FiHome, FiCommand, FiCreditCard, FiClipboard, FiSettings } from 'react-icons/fi';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import { getBillingCredits } from '../../services/api';

interface HeaderProps {
  onMenuToggle?: () => void;
}

/** Per-page contextual help tips keyed by route prefix */
const PAGE_HELP: Record<string, { icon: React.ReactNode; title: string; tips: string[] }> = {
  '/qa-loop': {
    icon: <FiZap className="h-4 w-4 text-primary-400" />,
    title: 'QA Loop',
    tips: [
      'Enter a URL and click "Start Exploration" to begin an AI-driven QA session.',
      'Use Smart mode for targeted testing or Explore mode for full coverage.',
      'Toggle Advanced Options to control depth, browser headless mode, and agent behavior.',
      'Generated test cases are automatically saved for reuse.',
    ],
  },
  '/': {
    icon: <FiHome className="h-4 w-4 text-primary-400" />,
    title: 'Dashboard',
    tips: [
      'Your dashboard shows an overview of all test activity.',
      'Click any stat card to navigate to the detailed list.',
      'Use QA Loop to start a new automated testing session.',
    ],
  },
  '/projects': {
    icon: <FiFolder className="h-4 w-4 text-primary-400" />,
    title: 'Projects',
    tips: [
      'Projects group your user stories and generated test cases.',
      'Click a project card to view its user stories and test history.',
      'Add a website URL to a project to pre-fill it in QA Loop.',
    ],
  },
  '/test-results': {
    icon: <FiClipboard className="h-4 w-4 text-primary-400" />,
    title: 'Test Results',
    tips: [
      'Use the tabs to switch between Test Runs and Test Cases.',
      'Click a run to see the full step-by-step execution log.',
      'Test cases are generated automatically during QA Loop sessions.',
    ],
  },
  '/settings': {
    icon: <FiSettings className="h-4 w-4 text-primary-400" />,
    title: 'Settings',
    tips: [
      'Configure environments, integrations, GitHub repos, notifications, and billing.',
      'Use tabs to navigate between different settings sections.',
      'Connect Jira, ClickUp, or Linear to create bug tickets automatically.',
    ],
  },
};

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const location = useLocation();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  // Fetch credit balance
  useEffect(() => {
    if (!user) return;
    getBillingCredits()
      .then((data) => {
        const bal = data?.balance;
        setCreditBalance(typeof bal === 'object' && bal !== null ? bal.balance ?? 0 : bal ?? null);
      })
      .catch(() => {});
  }, [user, location.pathname]);

  /** Get up-to-two-letter initials from the user's name */
  const initials = user
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?';

  useKeyboardShortcut('/', () => setShortcutsOpen(true), { metaKey: true, ctrlKey: true });

  /** Close help popover on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    if (helpOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [helpOpen]);

  /** Match the current pathname to a help entry */
  const getPageHelp = () => {
    const path = location.pathname;
    const keys = Object.keys(PAGE_HELP).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (key === '/' ? path === '/' : path.startsWith(key)) {
        return PAGE_HELP[key];
      }
    }
    return null;
  };

  const pageHelp = getPageHelp();

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);

    if (paths.length === 0) {
      return [{ label: 'Dashboard', path: '/' }];
    }

    const topLevelMap: { [key: string]: string } = {
      'qa-loop': 'QA Loop',
      'test-results': 'Test Results',
      'settings': 'Settings',
      'architecture-flow': 'Architecture',
    };

    const pathMap: { [key: string]: string } = {
      ...topLevelMap,
      'projects': 'Projects',
      'personas': 'Personas',
      'execute': 'Execute Test',
    };

    const firstSegment = paths[0];

    if (topLevelMap[firstSegment]) {
      const breadcrumbs: { label: string; path: string }[] = [];
      paths.forEach((path, index) => {
        const label = pathMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
        const fullPath = '/' + paths.slice(0, index + 1).join('/');
        breadcrumbs.push({ label, path: fullPath });
      });
      return breadcrumbs;
    }

    const breadcrumbs = [{ label: 'Projects', path: '/projects' }];
    paths.forEach((path, index) => {
      let label = pathMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
      if (paths[0] === 'projects' && index === 1 && path.includes('-')) {
        label = 'Project Details';
      }
      const fullPath = '/' + paths.slice(0, index + 1).join('/');
      breadcrumbs.push({ label, path: fullPath });
    });
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-16 bg-navy-800 border-b border-navy-700 flex items-center justify-between px-4 sm:px-6" role="banner">
      {/* Left: Hamburger (mobile) + WorkspaceSwitcher + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-navy-700 transition-colors"
          aria-label="Open navigation menu"
        >
          <FiMenu className="h-5 w-5 text-slate-500" />
        </button>
        <WorkspaceSwitcher />
        <span className="text-navy-700">|</span>
        <div className="flex items-center space-x-1 text-sm text-slate-500">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <span className="text-slate-400">/</span>}
              <Link
                to={crumb.path}
                className={`hover:text-white transition-colors ${
                  index === breadcrumbs.length - 1 ? 'text-slate-300 font-medium' : ''
                }`}
              >
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        {/* Credit Balance Pill */}
        {creditBalance !== null && (
          <Link
            to="/settings?tab=billing"
            className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              creditBalance <= 10
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : creditBalance <= 50
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}
            title="Credit balance"
          >
            <FiCreditCard className="h-3 w-3" />
            {creditBalance} credits
          </Link>
        )}

        {/* Contextual Help ("?") */}
        <div className="relative" ref={helpRef}>
          <button
            onClick={() => setHelpOpen((o) => !o)}
            className={`p-2 rounded-lg transition-colors ${helpOpen ? 'bg-primary-500/10 text-primary-400' : 'hover:bg-navy-700 text-slate-500'}`}
            aria-label="Show page help"
            title="Page help"
          >
            <FiHelpCircle className="h-5 w-5" />
          </button>

          {helpOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-navy-800 border border-navy-700 rounded-xl shadow-lg z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700 bg-navy-900">
                <div className="flex items-center gap-2">
                  {pageHelp?.icon}
                  <span className="text-sm font-semibold text-slate-300">
                    {pageHelp ? `${pageHelp.title} — Help` : 'Help'}
                  </span>
                </div>
                <button onClick={() => setHelpOpen(false)} className="p-1 rounded hover:bg-navy-700 transition-colors">
                  <FiX className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>

              {/* Tips */}
              {pageHelp ? (
                <ul className="p-4 space-y-2">
                  {pageHelp.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-400">
                      <span className="mt-0.5 flex-shrink-0 h-4 w-4 rounded-full bg-primary-500/10 text-primary-400 text-xs flex items-center justify-center font-semibold">
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-slate-400">No tips available for this page.</p>
              )}

              {/* Footer — Keyboard shortcuts link */}
              <div className="px-4 py-2 border-t border-navy-700 bg-navy-900">
                <button
                  onClick={() => { setHelpOpen(false); setShortcutsOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary-400 transition-colors"
                >
                  <FiCommand className="h-3 w-3" />
                  View keyboard shortcuts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar + Logout */}
        <div className="flex items-center gap-1 ml-1">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                {initials}
              </div>
            )}
            {user && (
              <span className="text-sm font-medium text-slate-400 hidden sm:block max-w-[120px] truncate">
                {user.name}
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-navy-700 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <FiLogOut className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  );
};
