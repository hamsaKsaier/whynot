import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getFlowData, executeTest, createFolder, updateFolder } from '../services/api';
import { Alert } from '../components/common/Alert';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';
import { FolderModal } from '../components/FolderManagement/FolderModal';
import {
  ProjectNode,
  FolderNode,
  UserStoryNode,
  TestSuiteNode,
  TestCaseNode,
  TestStepNode,
} from '../components/FlowNodes';
import type { FlowData, FlowNodeType, TestCase, UserStoryFolder } from '../types';
import {
  FiFolderPlus,
  FiGlobe,
  FiBook,
  FiPackage,
  FiFileText,
  FiActivity,
  FiFilter,
  FiMonitor,
} from 'react-icons/fi';
import { applyDagreLayout } from '../utils/dagreLayout';

// ─── Constants ──────────────────────────────────────────────────────────────

const nodeTypes = {
  project: ProjectNode,
  folder: FolderNode,
  userStory: UserStoryNode,
  testSuite: TestSuiteNode,
  testCase: TestCaseNode,
  testStep: TestStepNode,
};

/** Edge stroke colors by source node type */
const EDGE_COLORS: Record<string, string> = {
  project: '#0ea5e9',   // sky-blue
  folder: '#0284c7',    // sky blue
  userStory: '#22c55e', // green
  testSuite: '#f97316', // orange
  testCase: '#0EA5E9',  // sky blue
};

/** MiniMap colors by node type */
const MINIMAP_COLORS: Record<string, string> = {
  project: '#0ea5e9',
  folder: '#0284c7',
  userStory: '#22c55e',
  testSuite: '#f97316',
  testCase: '#a855f7',
  testStep: '#9ca3af',
};

/** Filter panel configuration */
const FILTER_ITEMS: { type: FlowNodeType; labelKey: string; color: string; borderColor: string }[] = [
  { type: 'project', labelKey: 'dashboard.architectureFlow.filters.project', color: 'bg-sky-900/200', borderColor: 'border-sky-300' },
  { type: 'folder', labelKey: 'dashboard.architectureFlow.filters.folder', color: 'bg-indigo-500', borderColor: 'border-indigo-300' },
  { type: 'userStory', labelKey: 'dashboard.architectureFlow.filters.userStory', color: 'bg-green-900/200', borderColor: 'border-green-800' },
  { type: 'testSuite', labelKey: 'dashboard.architectureFlow.filters.testSuite', color: 'bg-orange-500', borderColor: 'border-orange-800' },
  { type: 'testCase', labelKey: 'dashboard.architectureFlow.filters.testCase', color: 'bg-sky-900/200', borderColor: 'border-sky-300' },
  { type: 'testStep', labelKey: 'dashboard.architectureFlow.filters.testStep', color: 'bg-muted', borderColor: 'border-border' },
];

// ─── Stat Pill (inline helper component) ────────────────────────────────────

const StatPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}> = ({ icon, label, value, colorClass }) => (
  <div className="flex items-center gap-1.5">
    <span className={colorClass}>{icon}</span>
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className="font-bold text-foreground text-sm">{value}</span>
  </div>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEdge(
  id: string,
  source: string,
  target: string,
  sourceType: string,
): Edge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    style: { stroke: EDGE_COLORS[sourceType] || '#9ca3af', strokeWidth: 2 },
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const ArchitectureFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  // Full (unfiltered) graph
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);

  // ReactFlow display state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Page state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<FlowData['projects']>([]);

  // Test case map for running tests
  const [testCasesMap, setTestCasesMap] = useState<Map<string, TestCase>>(new Map());
  const [runningTestCases, setRunningTestCases] = useState<Set<string>>(new Set());

  // Expansion states
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set());

  // Visibility filter
  const [visibleTypes, setVisibleTypes] = useState<Set<FlowNodeType>>(
    new Set(['project', 'folder', 'userStory', 'testSuite', 'testCase']),
  );

  // Mobile filter panel toggle
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Folder modal
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<UserStoryFolder | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ── Stats ───────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let projects = 0;
    let folders = 0;
    let stories = 0;
    let suites = 0;
    let cases = 0;
    let steps = 0;
    flowData.forEach((p) => {
      projects++;
      folders += (p.folders || []).length;
      p.user_stories.forEach((us) => {
        stories++;
        us.test_suites.forEach((ts) => {
          suites++;
          ts.test_cases.forEach((tc) => {
            cases++;
            steps += tc.test_case.steps.length;
          });
        });
        (us.test_cases || []).forEach((tc) => {
          cases++;
          steps += tc.test_case.steps.length;
        });
      });
    });
    return { projects, folders, stories, suites, cases, steps };
  }, [flowData]);

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handleToggleExpand = useCallback((testCaseId: string) => {
    setExpandedTestCases((prev) => {
      const next = new Set(prev);
      next.has(testCaseId) ? next.delete(testCaseId) : next.add(testCaseId);
      return next;
    });
  }, []);

  const handleToggleFolderExpand = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  }, []);

  const toggleVisibility = useCallback((type: FlowNodeType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }, []);

  const handleRunTestCase = useCallback(
    async (testCaseId: string) => {
      const testCase = testCasesMap.get(testCaseId);
      if (!testCase) {
        setError(t('dashboard.architectureFlow.errors.testCaseNotFound'));
        return;
      }
      setRunningTestCases((prev) => new Set(prev).add(testCaseId));
      setError(null);
      try {
        const result = await executeTest(testCase, false);
        if ('execution_id' in result) {
          navigate(`/test-runs?execution=${result.execution_id}`);
        } else {
          setError(t('dashboard.architectureFlow.errors.noExecutionId'));
        }
      } catch (err: any) {
        let msg = t('dashboard.architectureFlow.errors.runFailed');
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          msg = t('dashboard.architectureFlow.errors.timeout');
        } else if (err.code === 'ERR_NETWORK' || !err.response) {
          msg = t('dashboard.architectureFlow.errors.network');
        } else if (err.response?.status >= 500) {
          msg = t('dashboard.architectureFlow.errors.server');
        } else if (err.response?.data?.error) {
          msg = err.response.data.error;
        } else if (err.message) {
          msg = err.message;
        }
        setError(msg);
      } finally {
        setRunningTestCases((prev) => {
          const next = new Set(prev);
          next.delete(testCaseId);
          return next;
        });
      }
    },
    [testCasesMap, navigate],
  );

  // ── Build graph (nodes + edges) — positions computed by dagre ───────────

  const buildFlowGraph = useCallback((projects: FlowData['projects']) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const newTestCasesMap = new Map<string, TestCase>();
    const zero = { x: 0, y: 0 }; // dagre will replace positions

    projects.forEach((projectData) => {
      const project = projectData.project;
      const projectNodeId = `project-${project.id}`;
      const folders = projectData.folders || [];

      // ── Project node
      newNodes.push({
        id: projectNodeId,
        type: 'project',
        position: zero,
        data: {
          label: project.name,
          description: project.description,
          website_url: project.website_url,
        },
      });

      // Group user stories by folder
      const userStoriesByFolder = new Map<string | null, typeof projectData.user_stories>();
      projectData.user_stories.forEach((us) => {
        const folderId = (us.user_story as any).folder_id || null;
        if (!userStoriesByFolder.has(folderId)) userStoriesByFolder.set(folderId, []);
        userStoriesByFolder.get(folderId)!.push(us);
      });

      // ── Folder nodes
      folders.forEach((folder) => {
        const folderNodeId = `folder-${folder.id}`;
        const folderStories = userStoriesByFolder.get(folder.id) || [];

        newNodes.push({
          id: folderNodeId,
          type: 'folder',
          position: zero,
          data: {
            label: folder.name,
            folderId: folder.id,
            color: folder.color,
            userStoryCount: folderStories.length,
          },
        });
        newEdges.push(makeEdge(
          `e-${projectNodeId}-${folderNodeId}`,
          projectNodeId,
          folderNodeId,
          'project',
        ));

        // User stories under folder
        folderStories.forEach((usData) => {
          const us = usData.user_story;
          const usNodeId = `userstory-${us.id}`;
          newNodes.push({
            id: usNodeId,
            type: 'userStory',
            position: zero,
            data: { label: us.story, story: us.story, website_url: us.website_url, folderId: folder.id },
          });
          newEdges.push(makeEdge(`e-${folderNodeId}-${usNodeId}`, folderNodeId, usNodeId, 'folder'));
        });
      });

      // ── Unfiled user stories (directly under project)
      const unfiled = userStoriesByFolder.get(null) || [];
      unfiled.forEach((usData) => {
        const us = usData.user_story;
        const usNodeId = `userstory-${us.id}`;
        newNodes.push({
          id: usNodeId,
          type: 'userStory',
          position: zero,
          data: { label: us.story, story: us.story, website_url: us.website_url },
        });
        newEdges.push(makeEdge(`e-${projectNodeId}-${usNodeId}`, projectNodeId, usNodeId, 'project'));
      });

      // ── Test suites, test cases, test steps for each user story
      projectData.user_stories.forEach((usData) => {
        const us = usData.user_story;
        const usNodeId = `userstory-${us.id}`;

        // Test suites
        usData.test_suites.forEach((tsData) => {
          const ts = tsData.test_suite;
          const tsNodeId = `testsuite-${ts.id}`;

          newNodes.push({
            id: tsNodeId,
            type: 'testSuite',
            position: zero,
            data: { label: ts.name, description: ts.description },
          });
          newEdges.push(makeEdge(`e-${usNodeId}-${tsNodeId}`, usNodeId, tsNodeId, 'userStory'));

          // Test cases in suite
          tsData.test_cases.forEach((tcData) => {
            const tc = tcData.test_case;
            const tcNodeId = `testcase-${tc.id}`;
            newTestCasesMap.set(tc.id, tc);

            newNodes.push({
              id: tcNodeId,
              type: 'testCase',
              position: zero,
              data: {
                label: tc.name,
                description: tc.description,
                stepCount: tc.steps.length,
                testCaseId: tc.id,
              },
            });
            newEdges.push(makeEdge(`e-${tsNodeId}-${tcNodeId}`, tsNodeId, tcNodeId, 'testSuite'));

            // Test steps
            tc.steps.forEach((step, si) => {
              const stepNodeId = `teststep-${tc.id}-${step.id}`;
              newNodes.push({
                id: stepNodeId,
                type: 'testStep',
                position: zero,
                data: {
                  label: step.description || `Step ${si + 1}`,
                  action: step.action,
                  description: step.description,
                },
              });
              newEdges.push(makeEdge(`e-${tcNodeId}-${stepNodeId}`, tcNodeId, stepNodeId, 'testCase'));
            });
          });
        });

        // Direct test cases (no suite)
        (usData.test_cases || []).forEach((tcData) => {
          const tc = tcData.test_case;
          const tcNodeId = `testcase-${tc.id}`;
          newTestCasesMap.set(tc.id, tc);

          newNodes.push({
            id: tcNodeId,
            type: 'testCase',
            position: zero,
            data: {
              label: tc.name,
              description: tc.description,
              stepCount: tc.steps.length,
              testCaseId: tc.id,
            },
          });
          newEdges.push(makeEdge(`e-${usNodeId}-${tcNodeId}`, usNodeId, tcNodeId, 'userStory'));

          tc.steps.forEach((step, si) => {
            const stepNodeId = `teststep-${tc.id}-${step.id}`;
            newNodes.push({
              id: stepNodeId,
              type: 'testStep',
              position: zero,
              data: {
                label: step.description || `Step ${si + 1}`,
                action: step.action,
                description: step.description,
              },
            });
            newEdges.push(makeEdge(`e-${tcNodeId}-${stepNodeId}`, tcNodeId, stepNodeId, 'testCase'));
          });
        });
      });
    });

    // Apply dagre layout to compute positions
    const { nodes: layouted } = applyDagreLayout(newNodes, newEdges, {
      rankdir: 'TB',
      nodesep: 80,
      ranksep: 100,
    });

    setAllNodes(layouted);
    setAllEdges(newEdges);
    setTestCasesMap(newTestCasesMap);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────

  const fetchFlowData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFlowData();
      setFlowData(response.projects);
      buildFlowGraph(response.projects);
    } catch (err: any) {
      let msg = t('dashboard.architectureFlow.errors.loadFailed');
      if (err.code === 'ERR_NETWORK' || !err.response) {
        msg = t('dashboard.architectureFlow.errors.network');
      } else if (err.response?.status >= 500) {
        msg = t('dashboard.architectureFlow.errors.server');
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildFlowGraph]);

  const handleFolderSubmit = useCallback(
    async (data: { name: string; color: string }) => {
      if (!selectedProjectId) throw new Error(t('dashboard.architectureFlow.errors.noProjectSelected'));
      try {
        if (editingFolder) {
          await updateFolder(editingFolder.id, data);
        } else {
          await createFolder(selectedProjectId, data);
        }
        await fetchFlowData();
      } catch (err: any) {
        const msg = editingFolder ? t('dashboard.architectureFlow.errors.updateFolderFailed') : t('dashboard.architectureFlow.errors.createFolderFailed');
        throw new Error(err.response?.data?.error || err.message || msg);
      }
    },
    [selectedProjectId, editingFolder, fetchFlowData],
  );

  const openCreateFolderModal = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setEditingFolder(null);
    setFolderModalOpen(true);
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchFlowData();
  }, [fetchFlowData]);

  // Auto-expand all folders on first load
  useEffect(() => {
    if (flowData.length > 0 && expandedFolders.size === 0) {
      const ids: string[] = [];
      flowData.forEach((p) => (p.folders || []).forEach((f) => ids.push(f.id)));
      if (ids.length > 0) setExpandedFolders(new Set(ids));
    }
  }, [flowData, expandedFolders.size]);

  // Filter nodes/edges AND re-layout with dagre so there are no gaps
  useEffect(() => {
    if (allNodes.length === 0) return;

    // 1. Filter by visibility + expansion state
    const filteredNodes = allNodes.filter((node) => {
      const t = node.type as FlowNodeType;
      if (!visibleTypes.has(t)) return false;

      // User stories in collapsed folders → hide
      if (t === 'userStory' && node.data.folderId && !expandedFolders.has(node.data.folderId)) {
        return false;
      }

      // Test steps in collapsed test cases → hide
      if (t === 'testStep') {
        const testCaseId = node.id.split('-')[1];
        return expandedTestCases.has(testCaseId);
      }
      return true;
    });

    // 2. Inject interactive callbacks
    const withHandlers = filteredNodes.map((node) => {
      if (node.type === 'folder') {
        const folderId = node.id.replace('folder-', '');
        return {
          ...node,
          data: {
            ...node.data,
            folderId,
            isExpanded: expandedFolders.has(folderId),
            onToggleExpand: handleToggleFolderExpand,
          },
        };
      }
      if (node.type === 'testCase') {
        const testCaseId = node.id.replace('testcase-', '');
        return {
          ...node,
          data: {
            ...node.data,
            testCaseId,
            isExpanded: expandedTestCases.has(testCaseId),
            isRunning: runningTestCases.has(testCaseId),
            onToggleExpand: handleToggleExpand,
            onRun: handleRunTestCase,
          },
        };
      }
      return node;
    });

    // 3. Filter edges (both ends must be visible)
    const visibleIds = new Set(withHandlers.map((n) => n.id));
    const filteredEdges = allEdges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );

    // 4. Re-layout the visible subset so gaps collapse
    const { nodes: relayouted } = applyDagreLayout(withHandlers, filteredEdges, {
      rankdir: 'TB',
      nodesep: 80,
      ranksep: 100,
    });

    setNodes(relayouted);
    setEdges(filteredEdges);
  }, [
    allNodes,
    allEdges,
    visibleTypes,
    expandedFolders,
    expandedTestCases,
    runningTestCases,
    handleToggleFolderExpand,
    handleToggleExpand,
    handleRunTestCase,
    setNodes,
    setEdges,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert type="error" message={error} />
      </div>
    );
  }

  const firstProjectId = flowData.length > 0 ? flowData[0].project.id : null;

  return (
    <div className="w-full flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('dashboard.architectureFlow.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('dashboard.architectureFlow.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileFiltersOpen((p) => !p)}
            className="p-2 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition-colors md:hidden"
            aria-label={t('dashboard.architectureFlow.toggleFilters')}
          >
            <FiFilter className="h-4 w-4" />
          </button>
          {firstProjectId && (
            <Button onClick={() => openCreateFolderModal(firstProjectId)} variant="primary" size="sm">
              <FiFolderPlus className="inline me-2" />
              <span className="hidden sm:inline">{t('dashboard.architectureFlow.createFolder')}</span>
              <span className="sm:hidden">{t('dashboard.architectureFlow.folder')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-6 px-4 sm:px-5 py-2 sm:py-2.5 bg-background border-b border-border">
        <StatPill icon={<FiGlobe className="h-3.5 w-3.5" />} label={t('dashboard.architectureFlow.stats.projects')} value={stats.projects} colorClass="text-sky-500" />
        <StatPill icon={<FiBook className="h-3.5 w-3.5" />} label={t('dashboard.architectureFlow.stats.stories')} value={stats.stories} colorClass="text-green-500" />
        <StatPill icon={<FiPackage className="h-3.5 w-3.5" />} label={t('dashboard.architectureFlow.stats.suites')} value={stats.suites} colorClass="text-orange-500" />
        <StatPill icon={<FiFileText className="h-3.5 w-3.5" />} label={t('dashboard.architectureFlow.stats.cases')} value={stats.cases} colorClass="text-sky-500" />
        <StatPill icon={<FiActivity className="h-3.5 w-3.5" />} label={t('dashboard.architectureFlow.stats.steps')} value={stats.steps} colorClass="text-muted-foreground" />
      </div>

      {/* Mobile small-screen warning */}
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs border-b border-border sm:hidden">
        <FiMonitor className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{t('dashboard.architectureFlow.mobileWarning')}</span>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { strokeWidth: 2 },
          }}
        >
          <Controls position="bottom-left" />
          <Background color="#334155" gap={20} size={1} />
          <div className="hidden md:block">
            <MiniMap
              nodeColor={(node) => MINIMAP_COLORS[node.type || ''] || '#9ca3af'}
              maskColor="rgba(0,0,0,0.08)"
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* Visibility filter panel - hidden on mobile, toggled via button */}
          <Panel position="top-right" className={`bg-card p-3 rounded-lg shadow-sm border border-border ${mobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('dashboard.architectureFlow.filtersTitle')}
            </div>
            <div className="space-y-1.5">
              {FILTER_ITEMS.map(({ type, labelKey, color }) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded-lg transition-colors text-sm"
                  onClick={() => toggleVisibility(type)}
                >
                  <input
                    type="checkbox"
                    checked={visibleTypes.has(type)}
                    onChange={() => toggleVisibility(type)}
                    className="rounded border-border text-muted-foreground focus:ring-border"
                  />
                  <div className={`w-3 h-3 rounded-sm ${color}`} />
                  <span className="text-foreground">{t(labelKey)}</span>
                </label>
              ))}
            </div>
            <div className="mt-2.5 pt-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground">
                {t('dashboard.architectureFlow.expandHint')}
              </p>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Folder modal */}
      {firstProjectId && (
        <FolderModal
          isOpen={folderModalOpen}
          onClose={() => {
            setFolderModalOpen(false);
            setEditingFolder(null);
            setSelectedProjectId(null);
          }}
          onSubmit={handleFolderSubmit}
          folder={editingFolder}
          projectId={firstProjectId}
        />
      )}
    </div>
  );
};
