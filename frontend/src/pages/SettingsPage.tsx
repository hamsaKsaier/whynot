import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiServer, FiLink, FiGithub, FiBell, FiCreditCard } from 'react-icons/fi';
import { Tabs } from '../components/common/Tabs';
import { EnvironmentsContent } from './EnvironmentsPage';
import { IntegrationsContent } from './IntegrationsPage';
import { GitHubReposContent } from './GitHubReposPage';
import { WebhookContent } from './WebhookManagementPage';
import { BillingContent } from './BillingPage';

const TABS = [
  { id: 'environments', label: 'Environments', icon: <FiServer className="h-4 w-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <FiLink className="h-4 w-4" /> },
  { id: 'github', label: 'GitHub Repos', icon: <FiGithub className="h-4 w-4" /> },
  { id: 'webhooks', label: 'Notifications', icon: <FiBell className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', icon: <FiCreditCard className="h-4 w-4" /> },
];

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'environments';

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Configure environments, integrations, and billing</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="mt-6">
        {activeTab === 'environments' && <EnvironmentsContent />}
        {activeTab === 'integrations' && <IntegrationsContent />}
        {activeTab === 'github' && <GitHubReposContent />}
        {activeTab === 'webhooks' && <WebhookContent />}
        {activeTab === 'billing' && <BillingContent />}
      </div>
    </div>
  );
};
