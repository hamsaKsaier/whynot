import React from 'react';

export const CreditsPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Credit Management</h1>
      <p className="text-sm text-slate-400">
        To manage credits for a specific workspace, navigate to Users, select a user, and use the credit controls on their workspace.
      </p>
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center text-slate-500">
        Global credit analytics coming soon (Phase 6)
      </div>
    </div>
  );
};
