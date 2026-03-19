import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiPackage,
  FiCreditCard,
  FiDollarSign,
  FiShield,
  FiBarChart2,
  FiFileText,
  FiSettings,
  FiBell,
} from 'react-icons/fi';

const navSections = [
  {
    title: null,
    items: [
      { icon: FiHome, label: 'Dashboard', path: '/' },
      { icon: FiBarChart2, label: 'Analytics', path: '/analytics' },
    ],
  },
  {
    title: 'Management',
    items: [
      { icon: FiUsers, label: 'Users', path: '/users' },
      { icon: FiPackage, label: 'Plans', path: '/plans' },
      { icon: FiCreditCard, label: 'Subscriptions', path: '/subscriptions' },
      { icon: FiDollarSign, label: 'Credits', path: '/credits' },
    ],
  },
  {
    title: 'System',
    items: [
      { icon: FiBell, label: 'Announcements', path: '/announcements' },
      { icon: FiFileText, label: 'Audit Log', path: '/audit-log' },
      { icon: FiSettings, label: 'Settings', path: '/settings' },
    ],
  },
];

export const AdminSidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <FiShield className="h-6 w-6 text-primary-400 mr-3" />
        <span className="font-bold text-lg">Admin Panel</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="px-3 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">{section.title}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
        WhyNot Admin v0.1
      </div>
    </div>
  );
};
