import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');

  if (!isOpen) return null;

  const messages = {
    credits: {
      title: t('common.upgrade.credits.title'),
      description: details
        ? t('common.upgrade.credits.descriptionDetailed', { required: details.required, available: details.available })
        : t('common.upgrade.credits.description'),
      action: t('common.upgrade.credits.action'),
    },
    feature: {
      title: t('common.upgrade.feature.title'),
      description: details?.feature
        ? t('common.upgrade.feature.descriptionDetailed', { feature: details.feature })
        : t('common.upgrade.feature.description'),
      action: t('common.upgrade.feature.action'),
    },
    subscription: {
      title: t('common.upgrade.subscription.title'),
      description: details?.status === 'TRIAL_EXPIRED'
        ? t('common.upgrade.subscription.descriptionTrialExpired')
        : t('common.upgrade.subscription.description'),
      action: t('common.upgrade.subscription.action'),
    },
  };

  const msg = messages[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-sm max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-foreground">{msg.title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <FiX className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground">{msg.description}</p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground hover:bg-accent rounded-lg"
          >
            {t('common.actions.cancel')}
          </button>
          <button
            onClick={() => {
              onClose();
              window.location.href = '/billing';
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            {msg.action}
            <FiArrowRight className="ms-1.5 h-4 w-4 rtl:scale-x-[-1]" />
          </button>
        </div>
      </div>
    </div>
  );
};
