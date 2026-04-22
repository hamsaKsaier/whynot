import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ExternalLink, Check, X, Send, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
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
  const { t } = useTranslation('runner');
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
      setResult({ success: false, error: error.response?.data?.error || t('runner.qaLoop.createTask.failedToCreate') });
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

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'jira': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'clickup': return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800';
      case 'linear': return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className={cn('gap-1 text-xs h-7 px-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300', className)}
        title={t('runner.qaLoop.createTask.tooltip')}
      >
        <Send className="h-3 w-3" />
        <span>{t('runner.qaLoop.createTask.title')}</span>
      </Button>

      <Dialog open={showModal} onOpenChange={open => { if (!open) setShowModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('runner.qaLoop.createTask.title')}</DialogTitle>
            <DialogDescription className="truncate">Bug: {bugTitle}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                {t('runner.qaLoop.createTask.loading')}
              </div>
            ) : integrations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">{t('runner.qaLoop.createTask.noIntegrations')}</p>
                <a
                  href="/integrations"
                  className="text-primary hover:text-primary/80 text-sm font-medium"
                >
                  {t('runner.qaLoop.createTask.goToIntegrations')}
                </a>
              </div>
            ) : (
              <>
                {/* Existing tasks */}
                {existingTasks.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">{t('runner.qaLoop.createTask.existingTasks')}</div>
                    <div className="space-y-2">
                      {existingTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-xs', getTypeBadgeClass((task as any).integration_type || 'unknown'))}>
                              {getTypeLabel((task as any).integration_type || 'unknown')}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{task.external_id}</span>
                          </div>
                          {task.external_url && (
                            <a
                              href={task.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4 rtl:scale-x-[-1]" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Select integration */}
                <div className="space-y-1.5">
                  <Label>{t('runner.qaLoop.createTask.selectIntegration')}</Label>
                  <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {integrations.map((int) => (
                        <SelectItem key={int.id} value={int.id}>
                          {int.name} ({getTypeLabel(int.type)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Result message */}
                {result && (
                  <div className={cn(
                    'p-3 rounded-lg',
                    result.success
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  )}>
                    {result.success ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        <span>{t('runner.qaLoop.createTask.taskCreated')} <strong>{result.task?.external_id}</strong></span>
                        {result.task?.external_url && (
                          <a href={result.task.external_url} target="_blank" rel="noopener noreferrer" className="ms-auto">
                            <ExternalLink className="h-4 w-4 rtl:scale-x-[-1]" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4" />
                        <span>{result.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {t('runner.qaLoop.createTask.close')}
            </Button>
            {integrations.length > 0 && (
              <Button
                onClick={handleCreate}
                disabled={creating || !selectedIntegration}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('runner.qaLoop.createTask.creating')}
                  </>
                ) : (
                  t('runner.qaLoop.createTask.title')
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
