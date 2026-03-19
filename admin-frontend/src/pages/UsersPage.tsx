import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAdminUsers } from '../services/api';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers({
        offset,
        limit,
        search: search || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [offset, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <span className="text-sm text-slate-400">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="w-full pl-10 pr-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 border border-slate-600 rounded-lg text-sm"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Plan</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Credits</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-900">
                <td className="px-4 py-3">
                  <Link to={`/users/${user.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-800">
                    {user.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'super_admin' ? 'bg-red-900/30 text-red-300'
                    : user.role === 'admin' ? 'bg-sky-900/30 text-sky-300'
                    : 'bg-slate-800 text-slate-200'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{user.plan_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-right text-white font-medium">{user.credits}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="p-2 border rounded-lg disabled:opacity-50 hover:bg-slate-900"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="p-2 border rounded-lg disabled:opacity-50 hover:bg-slate-900"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
