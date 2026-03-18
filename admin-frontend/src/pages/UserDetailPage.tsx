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

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;
  if (!user) return <div className="text-gray-500">User not found</div>;

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <FiArrowLeft className="mr-1 h-4 w-4" /> Back to Users
      </Link>

      {/* User Profile */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
            <p className="text-xs text-gray-400 mt-1">ID: {user.id}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Role</label>
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-sm text-gray-500">
          <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
          {user.github_id && <span>GitHub connected</span>}
          {user.google_id && <span>Google connected</span>}
        </div>
      </div>

      {/* Workspaces */}
      {workspaces.map((ws: any) => (
        <div key={ws.id} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{ws.name}</h2>
              <p className="text-sm text-gray-500">
                Plan: {ws.plan_name || 'None'} | Status: {ws.subscription?.status || 'None'} | Credits: {ws.credits}
              </p>
            </div>
          </div>

          {/* Credit Management */}
          <div className="flex items-end gap-3 pt-4 border-t border-gray-100">
            <div>
              <label className="text-xs font-medium text-gray-500">Amount</label>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="100"
                className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500">Description</label>
              <input
                type="text"
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
                placeholder="Reason..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
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
