import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FiLogOut, FiUser } from 'react-icons/fi';

export const AdminHeader: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiUser className="h-4 w-4" />
          <span>{user?.name}</span>
          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
            {user?.role}
          </span>
        </div>
        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Logout"
        >
          <FiLogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
