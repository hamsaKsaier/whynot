import React from 'react';
import { FiAlertTriangle, FiX, FiArrowRight } from 'react-icons/fi';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'credits' | 'feature' | 'subscription';
  details?: {
    required?: number;
    available?: number;
    feature?: string;
    status?: string;
  };
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ isOpen, onClose, type, details }) => {
  if (!isOpen) return null;

  const messages = {
    credits: {
      title: 'Insufficient Credits',
      description: details
        ? `This operation requires ${details.required} credits but you only have ${details.available} remaining.`
        : 'You don\'t have enough credits for this operation.',
      action: 'Upgrade Plan',
    },
    feature: {
      title: 'Feature Not Available',
      description: details?.feature
        ? `The "${details.feature}" feature is not included in your current plan.`
        : 'This feature is not available on your current plan.',
      action: 'View Plans',
    },
    subscription: {
      title: 'Subscription Required',
      description: details?.status === 'TRIAL_EXPIRED'
        ? 'Your free trial has expired. Upgrade to continue using the platform.'
        : 'An active subscription is required to use this feature.',
      action: 'Upgrade Now',
    },
  };

  const msg = messages[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-white">{msg.title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg">
            <FiX className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-400">{msg.description}</p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              window.location.href = '/billing';
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            {msg.action}
            <FiArrowRight className="ml-1.5 h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
