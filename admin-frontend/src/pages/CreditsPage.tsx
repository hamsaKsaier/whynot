import React from 'react';

export const CreditsPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Credit Management</h1>
      <p className="text-sm text-gray-500">
        To manage credits for a specific workspace, navigate to Users, select a user, and use the credit controls on their workspace.
      </p>
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
        Global credit analytics coming soon (Phase 6)
      </div>
    </div>
  );
};
