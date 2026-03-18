import React, { useState, useEffect } from 'react';
import { FiExternalLink, FiCheck, FiX, FiSend } from 'react-icons/fi';
import { apiClient } from '../../services/api';

interface Integration {
  id: string;
  type: 'jira' | 'clickup' | 'linear';
  name: string;
  is_active: boolean;
}

interface BugTask {
  id: string;
  external_id: string;
  external_url: string | null;
  integration_type?: string;
  integration_name?: string;
  created_at: string;
}

interface CreateTaskButtonProps {
  bugId: string;
  bugTitle: string;
  className?: string;
}

export const CreateTaskButton: React.FC<CreateTaskButtonProps> = ({ bugId, bugTitle, className = '' }) => {
  const [showModal, setShowModal] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [existingTasks, setExistingTasks] = useState<BugTask[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; task?: BugTask; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const workspaceId = localStorage.getItem('active_workspace_id') || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const [intRes, taskRes] = await Promise.all([
        apiClient.get(`/integrations?workspace_id=${workspaceId}`),
        apiClient.get(`/bugs/${bugId}/tasks`),
      ]);
      const activeIntegrations = intRes.data.filter((i: Integration) => i.is_active);
      setIntegrations(activeIntegrations);
      setExistingTasks(taskRes.data);
      if (activeIntegrations.length > 0 && !selectedIntegration) {
        setSelectedIntegration(activeIntegrations[0].id);
      }
    } catch (error) {
      console.error('Failed to load integration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setShowModal(true);
    setResult(null);
    loadData();
  };

  const handleCreate = async () => {
    if (!selectedIntegration) return;

    try {
      setCreating(true);
      setResult(null);
      const res = await apiClient.post(`/bugs/${bugId}/create-task`, {
        integration_id: selectedIntegration,
      });
      setResult({ success: true, task: res.data });
      setExistingTasks(prev => [...prev, res.data]);
    } catch (error: any) {
      setResult({ success: false, error: error.response?.data?.error || 'Failed to create task' });
    } finally {
      setCreating(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'jira': return 'Jira';
      case 'clickup': return 'ClickUp';
      case 'linear': return 'Linear';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'jira': return 'bg-blue-100 text-blue-700';
      case 'clickup': return 'bg-sky-100 text-sky-700';
      case 'linear': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors ${className}`}
        title="Create task in Jira/ClickUp/Linear"
      >
        <FiSend className="h-3 w-3" />
        <span>Create Task</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Task</h3>
              <p className="text-sm text-gray-500 mt-1 truncate">Bug: {bugTitle}</p>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : integrations.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-3">No integrations configured</p>
                  <a
                    href="/integrations"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Go to Integrations to connect Jira, ClickUp, or Linear
                  </a>
                </div>
              ) : (
                <>
                  {/* Existing tasks */}
                  {existingTasks.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">Existing Tasks</div>
                      <div className="space-y-2">
                        {existingTasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor((task as any).integration_type || 'unknown')}`}>
                                {getTypeLabel((task as any).integration_type || 'unknown')}
                              </span>
                              <span className="text-sm font-medium text-gray-700">{task.external_id}</span>
                            </div>
                            {task.external_url && (
                              <a
                                href={task.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <FiExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Select integration */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Integration</label>
                    <select
                      value={selectedIntegration}
                      onChange={e => setSelectedIntegration(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {integrations.map((int) => (
                        <option key={int.id} value={int.id}>
                          {int.name} ({getTypeLabel(int.type)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Result message */}
                  {result && (
                    <div className={`p-3 rounded-lg mb-4 ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {result.success ? (
                        <div className="flex items-center gap-2">
                          <FiCheck className="h-4 w-4" />
                          <span>Task created: <strong>{result.task?.external_id}</strong></span>
                          {result.task?.external_url && (
                            <a href={result.task.external_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                              <FiExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FiX className="h-4 w-4" />
                          <span>{result.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              {integrations.length > 0 && (
                <button
                  onClick={handleCreate}
                  disabled={creating || !selectedIntegration}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
