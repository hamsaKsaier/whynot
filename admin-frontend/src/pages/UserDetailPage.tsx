import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAdminUser, updateUserRole, grantCredits, revokeCredits } from '../services/api';
import { FiArrowLeft, FiPlus, FiMinus } from 'react-icons/fi';

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');

  const fetchUser = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminUser(id);
      setUser(data.user);
      setWorkspaces(data.workspaces || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, [id]);

  const handleRoleChange = async (newRole: string) => {
    if (!id) return;
    await updateUserRole(id, newRole);
    await fetchUser();
  };

  const handleGrant = async (wsId: string) => {
    const amount = parseInt(creditAmount);
    if (!amount || amount <= 0) return;
    await grantCredits(wsId, amount, creditDescription || 'Admin grant');
    setCreditAmount('');
    setCreditDescription('');
    await fetchUser();
  };

  const handleRevoke = async (wsId: string) => {
    const amount = parseInt(creditAmount);
    if (!amount || amount <= 0) return;
    await revokeCredits(wsId, amount, creditDescription || 'Admin revoke');
    setCreditAmount('');
    setCreditDescription('');
    await fetchUser();
  };

  if (loading) return <div className="animate-pulse h-64 bg-slate-700 rounded-lg" />;
  if (!user) return <div className="text-slate-400">User not found</div>;

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200">
        <FiArrowLeft className="mr-1 h-4 w-4" /> Back to Users
      </Link>

      {/* User Profile */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{user.name}</h1>
            <p className="text-sm text-slate-400 mt-1">{user.email}</p>
            <p className="text-xs text-slate-500 mt-1">ID: {user.id}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Role</label>
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="px-3 py-1.5 border border-slate-600 rounded-lg text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-sm text-slate-400">
          <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
          {user.github_id && <span>GitHub connected</span>}
          {user.google_id && <span>Google connected</span>}
        </div>
      </div>

      {/* Workspaces */}
      {workspaces.map((ws: any) => (
        <div key={ws.id} className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{ws.name}</h2>
              <p className="text-sm text-slate-400">
                Plan: {ws.plan_name || 'None'} | Status: {ws.subscription?.status || 'None'} | Credits: {ws.credits}
              </p>
            </div>
          </div>

          {/* Credit Management */}
          <div className="flex items-end gap-3 pt-4 border-t border-slate-700">
            <div>
              <label className="text-xs font-medium text-slate-400">Amount</label>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="100"
                className="w-24 px-2 py-1.5 border border-slate-600 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-400">Description</label>
              <input
                type="text"
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
                placeholder="Reason..."
                className="w-full px-2 py-1.5 border border-slate-600 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={() => handleGrant(ws.id)}
              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              <FiPlus className="mr-1 h-3 w-3" /> Grant
            </button>
            <button
              onClick={() => handleRevoke(ws.id)}
              className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              <FiMinus className="mr-1 h-3 w-3" /> Revoke
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
