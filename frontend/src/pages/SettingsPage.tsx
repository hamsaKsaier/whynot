import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiServer, FiLink, FiGithub, FiBell, FiCreditCard, FiCpu, FiUser, FiUsers, FiKey, FiGlobe, FiAlertTriangle, FiBarChart2 } from 'react-icons/fi';
import { Tabs } from '../components/common/Tabs';
import { EnvironmentsContent } from './EnvironmentsPage';
import { IntegrationsContent } from './IntegrationsPage';
import { GitHubReposContent } from './GitHubReposPage';
import { WebhookContent } from './WebhookManagementPage';
import { BillingTab } from './settings/tabs/BillingTab';
import { AiContent } from './settings/tabs/AiTab';
import { ProfileTab } from './settings/tabs/ProfileTab';
import { OrganizationTab } from './settings/tabs/OrganizationTab';
import { ApiKeysTab } from './settings/tabs/ApiKeysTab';
import { LanguageTab } from './settings/tabs/LanguageTab';
import { NotificationsTab } from './settings/tabs/NotificationsTab';
import { DangerZoneTab } from './settings/tabs/DangerZoneTab';
import { UsageTab } from './settings/tabs/UsageTab';

const TABS = [
  { id: 'profile', label: 'Profile', icon: <FiUser className="h-4 w-4" /> },
  { id: 'organization', label: 'Organization', icon: <FiUsers className="h-4 w-4" /> },
  { id: 'environments', label: 'Environments', icon: <FiServer className="h-4 w-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <FiLink className="h-4 w-4" /> },
  { id: 'github', label: 'GitHub Repos', icon: <FiGithub className="h-4 w-4" /> },
  { id: 'ai', label: 'AI', icon: <FiCpu className="h-4 w-4" /> },
  { id: 'api-keys', label: 'API Keys', icon: <FiKey className="h-4 w-4" /> },
  { id: 'language', label: 'Language', icon: <FiGlobe className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <FiBell className="h-4 w-4" /> },
  { id: 'usage', label: 'Usage', icon: <FiBarChart2 className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', icon: <FiCreditCard className="h-4 w-4" /> },
  { id: 'danger-zone', label: 'Danger Zone', icon: <FiAlertTriangle className="h-4 w-4" /> },
];

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation('settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">{t('settings.title', { defaultValue: 'Settings' })}</h1>
        <p className="text-slate-400 mt-1">{t('settings.description', { defaultValue: 'Manage your account, organization, and preferences' })}</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="mt-6">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'environments' && <EnvironmentsContent />}
        {activeTab === 'integrations' && <IntegrationsContent />}
        {activeTab === 'github' && <GitHubReposContent />}
        {activeTab === 'ai' && <AiContent />}
        {activeTab === 'api-keys' && <ApiKeysTab />}
        {activeTab === 'language' && <LanguageTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'usage' && <UsageTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'danger-zone' && <DangerZoneTab />}
      </div>
    </div>
  );
};
