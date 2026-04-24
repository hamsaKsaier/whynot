import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiServer, FiLink, FiGithub, FiBell, FiCreditCard, FiCpu, FiUser, FiUsers, FiKey, FiGlobe, FiAlertTriangle, FiBarChart2, FiShield } from 'react-icons/fi';
import { Tabs, type Tab } from '../components/common/Tabs';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
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
import { ReconSettingsTab } from './settings/tabs/ReconSettingsTab';

function useSettingsTabs(reconEnabled: boolean): Tab[] {
  const { t } = useTranslation('settings');
  const base: Tab[] = [
    { id: 'profile', label: t('settings.tabs.profile', { defaultValue: 'Profile' }), icon: <FiUser className="h-4 w-4" /> },
    { id: 'organization', label: t('settings.tabs.organization', { defaultValue: 'Organization' }), icon: <FiUsers className="h-4 w-4" /> },
    { id: 'environments', label: t('settings.tabs.environments', { defaultValue: 'Environments' }), icon: <FiServer className="h-4 w-4" /> },
    { id: 'integrations', label: t('settings.tabs.integrations', { defaultValue: 'Integrations' }), icon: <FiLink className="h-4 w-4" /> },
    { id: 'github', label: t('settings.tabs.github', { defaultValue: 'GitHub Repos' }), icon: <FiGithub className="h-4 w-4" /> },
    { id: 'ai', label: t('settings.tabs.ai', { defaultValue: 'AI' }), icon: <FiCpu className="h-4 w-4" /> },
    { id: 'api-keys', label: t('settings.tabs.apiKeys', { defaultValue: 'API Keys' }), icon: <FiKey className="h-4 w-4" /> },
    { id: 'language', label: t('settings.tabs.language', { defaultValue: 'Language' }), icon: <FiGlobe className="h-4 w-4" /> },
    { id: 'notifications', label: t('settings.tabs.notifications', { defaultValue: 'Notifications' }), icon: <FiBell className="h-4 w-4" /> },
    { id: 'usage', label: t('settings.tabs.usage', { defaultValue: 'Usage' }), icon: <FiBarChart2 className="h-4 w-4" /> },
    { id: 'billing', label: t('settings.tabs.billing', { defaultValue: 'Billing' }), icon: <FiCreditCard className="h-4 w-4" /> },
    { id: 'danger-zone', label: t('settings.tabs.dangerZone', { defaultValue: 'Danger Zone' }), icon: <FiAlertTriangle className="h-4 w-4" /> },
  ];
  if (reconEnabled) {
    base.splice(base.length - 1, 0, {
      id: 'recon',
      label: t('settings.recon.tab.label', { defaultValue: 'Recon' }),
      icon: <FiShield className="h-4 w-4" />,
    });
  }
  return base;
}

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation('settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const reconEnabled = useFeatureFlag('recon_enabled');
  const requestedTab = searchParams.get('tab') || 'profile';
  const activeTab = requestedTab === 'recon' && !reconEnabled ? 'profile' : requestedTab;
  const tabs = useSettingsTabs(reconEnabled);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="px-4 sm:px-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('settings.title', { defaultValue: 'Settings' })}</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('settings.description', { defaultValue: 'Manage your account, organization, and preferences' })}</p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="mt-4 sm:mt-6">
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
        {activeTab === 'recon' && reconEnabled && <ReconSettingsTab />}
        {activeTab === 'danger-zone' && <DangerZoneTab />}
      </div>
    </div>
  );
};
