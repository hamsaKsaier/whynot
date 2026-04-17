import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiLink, FiPlus, FiTrash2, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal, ModalFooter } from '../components/common/Modal';

interface Integration {
  id: string;
  workspace_id: string;
  type: 'jira' | 'clickup' | 'linear';
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const INTEGRATION_TYPES = [
  {
    type: 'jira' as const,
    label: 'Jira',
    descriptionKey: 'dashboard.integrations.types.jira.description',
    icon: '/jira-icon.svg',
    color: 'bg-blue-900/200',
    fields: [
      { key: 'apiUrl', labelKey: 'dashboard.integrations.types.jira.apiUrlLabel', placeholder: 'https://yourteam.atlassian.net', type: 'text' },
      { key: 'email', labelKey: 'dashboard.integrations.types.jira.emailLabel', placeholder: 'you@example.com', type: 'email' },
      { key: 'apiToken', labelKey: 'dashboard.integrations.types.jira.apiTokenLabel', placeholder: 'dashboard.integrations.types.jira.apiTokenPlaceholder', type: 'password' },
      { key: 'projectKey', labelKey: 'dashboard.integrations.types.jira.projectKeyLabel', placeholder: 'PROJ', type: 'text' },
    ],
  },
  {
    type: 'clickup' as const,
    label: 'ClickUp',
    descriptionKey: 'dashboard.integrations.types.clickup.description',
    icon: '/clickup-icon.svg',
    color: 'bg-sky-900/200',
    fields: [
      { key: 'apiToken', labelKey: 'dashboard.integrations.types.clickup.apiTokenLabel', placeholder: 'dashboard.integrations.types.clickup.apiTokenPlaceholder', type: 'password' },
      { key: 'listId', labelKey: 'dashboard.integrations.types.clickup.listIdLabel', placeholder: 'dashboard.integrations.types.clickup.listIdPlaceholder', type: 'text' },
    ],
  },
  {
    type: 'linear' as const,
    label: 'Linear',
    descriptionKey: 'dashboard.integrations.types.linear.description',
    icon: '/linear-icon.svg',
    color: 'bg-indigo-500',
    fields: [
      { key: 'apiKey', labelKey: 'dashboard.integrations.types.linear.apiKeyLabel', placeholder: 'dashboard.integrations.types.linear.apiKeyPlaceholder', type: 'password' },
      { key: 'teamId', labelKey: 'dashboard.integrations.types.linear.teamIdLabel', placeholder: 'dashboard.integrations.types.linear.teamIdPlaceholder', type: 'text' },
    ],
  },
];

export const IntegrationsContent: React.FC = () => <IntegrationsPage embedded />;

export const IntegrationsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { t } = useTranslation('dashboard');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<typeof INTEGRATION_TYPES[number] | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formName, setFormName] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { success, error: showError } = useToastContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/integrations?workspace_id=${workspaceId}`);
      setIntegrations(res.data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async () => {
    if (!selectedType || !formName.trim()) return;

    try {
      setSaving(true);
      await apiClient.post('/integrations', {
        workspace_id: workspaceId,
        type: selectedType.type,
        name: formName,
        config: formData,
      });
      setShowAddModal(false);
      setSelectedType(null);
      setFormData({});
      setFormName('');
      await loadIntegrations();
    } catch (error: any) {
      showError(error.response?.data?.error || t('dashboard.integrations.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      setTesting(id);
      setTestResult(null);
      const res = await apiClient.post(`/integrations/${id}/test`);
      setTestResult({ id, ...res.data });
    } catch (error: any) {
      setTestResult({ id, success: false, message: error.response?.data?.error || t('dashboard.integrations.connectionFailed') });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await apiClient.delete(`/integrations/${id}`);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      success(t('dashboard.integrations.deleted'));
    } catch (error: any) {
      showError(error.response?.data?.error || t('dashboard.integrations.deleteError'));
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const getTypeInfo = (type: string) => INTEGRATION_TYPES.find(t => t.type === type);

  return (
    <div className={embedded ? '' : 'p-6 max-w-4xl mx-auto'}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('dashboard.integrations.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.integrations.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-foreground rounded-lg hover:bg-primary-700 transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            {t('dashboard.integrations.add')}
          </button>
        </div>
      )}

      {/* Integrations List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('dashboard.integrations.loading')}</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-16 bg-muted rounded-xl border border-dashed border-border">
          <FiLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('dashboard.integrations.emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('dashboard.integrations.emptyDescription')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-foreground rounded-lg hover:bg-primary-700 transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            {t('dashboard.integrations.add')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => {
            const typeInfo = getTypeInfo(integration.type);
            return (
              <div key={integration.id} className="bg-card rounded-lg border border-border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${typeInfo?.color || 'bg-muted'} flex items-center justify-center text-foreground font-bold text-sm`}>
                      {integration.type === 'jira' ? 'J' : integration.type === 'clickup' ? 'C' : 'L'}
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{integration.name}</h3>
                      <p className="text-xs text-muted-foreground">{typeInfo?.label} &middot; {integration.is_active ? t('dashboard.integrations.active') : t('dashboard.integrations.inactive')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult?.id === integration.id && (
                      <span className={`text-xs px-2 py-1 rounded ${testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {testResult.success ? <FiCheck className="inline me-1" /> : <FiX className="inline me-1" />}
                        {testResult.message}
                      </span>
                    )}
                    <button
                      onClick={() => handleTestConnection(integration.id)}
                      disabled={testing === integration.id}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-50"
                      title={t('dashboard.integrations.testConnection')}
                    >
                      <FiRefreshCw className={`h-4 w-4 ${testing === integration.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(integration.id)}
                      disabled={deleting === integration.id}
                      className="p-2 text-red-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title={t('dashboard.integrations.deleteIntegration')}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {integration.config.apiUrl && <span>URL: {integration.config.apiUrl}</span>}
                  {integration.config.projectKey && <span className="ms-3">Project: {integration.config.projectKey}</span>}
                  {integration.config.listId && <span className="ms-3">List: {integration.config.listId}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Integration Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={selectedType ? t('dashboard.integrations.connectType', { type: selectedType.label }) : t('dashboard.integrations.add')}
        size="lg"
      >
        {!selectedType ? (
          /* Type selection */
          <div className="space-y-3">
            {INTEGRATION_TYPES.map((type) => (
              <button
                key={type.type}
                onClick={() => {
                  setSelectedType(type);
                  setFormName(type.label);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-900/20 transition-colors text-start"
              >
                <div className={`w-12 h-12 rounded-lg ${type.color} flex items-center justify-center text-foreground font-bold`}>
                  {type.type === 'jira' ? 'J' : type.type === 'clickup' ? 'C' : 'L'}
                </div>
                <div>
                  <div className="font-medium text-foreground">{type.label}</div>
                  <div className="text-sm text-muted-foreground">{t(type.descriptionKey)}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Config form */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.integrations.nameLabel')}</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="My Jira Integration"
              />
            </div>
            {selectedType.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{t(field.labelKey)}</label>
                <input
                  type={field.type}
                  value={formData[field.key] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        )}

        <ModalFooter>
          <button
            onClick={() => {
              if (selectedType) {
                setSelectedType(null);
                setFormData({});
              } else {
                setShowAddModal(false);
              }
            }}
            className="px-4 py-2 text-foreground bg-muted rounded-lg hover:bg-muted/70 transition-colors"
          >
            {selectedType ? t('dashboard.integrations.back') : t('dashboard.integrations.cancel')}
          </button>
          {selectedType && (
            <button
              onClick={handleAddIntegration}
              disabled={saving || !formName.trim()}
              className="px-4 py-2 bg-primary-600 text-foreground rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? t('dashboard.integrations.connecting') : t('dashboard.integrations.connect')}
            </button>
          )}
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={t('dashboard.integrations.deleteTitle')}
        message={t('dashboard.integrations.deleteMessage')}
        confirmText={t('dashboard.integrations.deleteConfirm')}
        cancelText={t('dashboard.integrations.cancel')}
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};
