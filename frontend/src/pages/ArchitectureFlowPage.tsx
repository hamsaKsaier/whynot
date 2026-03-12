import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getFlowData, executeTest, getTestCases, createFolder, updateFolder, deleteFolder } from '../services/api';
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
import { FiFolderPlus } from 'react-icons/fi';

const nodeTypes = {
  project: ProjectNode,
  folder: FolderNode,
  userStory: UserStoryNode,
  testSuite: TestSuiteNode,
  testCase: TestCaseNode,
  testStep: TestStepNode,
};

export const ArchitectureFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<FlowData['projects']>([]);

  // Store test cases for running
  const [testCasesMap, setTestCasesMap] = useState<Map<string, TestCase>>(new Map());

  // Track running test cases
  const [runningTestCases, setRunningTestCases] = useState<Set<string>>(new Set());

  // Track expanded folders (expanded by default)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Track expanded test cases (collapsed by default)
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set());

  // Track visible node types (all visible by default except testStep)
  const [visibleTypes, setVisibleTypes] = useState<Set<FlowNodeType>>(
    new Set(['project', 'folder', 'userStory', 'testSuite', 'testCase'])
  );

  // Folder management
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<UserStoryFolder | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Toggle test case expansion
  const handleToggleExpand = useCallback((testCaseId: string) => {
    setExpandedTestCases(prev => {
      const next = new Set(prev);
      if (next.has(testCaseId)) {
        next.delete(testCaseId);
      } else {
        next.add(testCaseId);
      }
      return next;
    });
  }, []);

  // Toggle folder expansion
  const handleToggleFolderExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Toggle visibility of node types
  const toggleVisibility = useCallback((type: FlowNodeType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Handle running a test case
  const handleRunTestCase = useCallback(async (testCaseId: string) => {
    const testCase = testCasesMap.get(testCaseId);
    if (!testCase) {
      setError(`Test case not found. Please refresh the page.`);
      return;
    }

    setRunningTestCases(prev => new Set(prev).add(testCaseId));
    setError(null);

    try {
      // Execute the test (non-headless mode for live preview)
      const result = await executeTest(testCase, false);

      // Navigate to test runs page to see the execution
      if ('execution_id' in result) {
        navigate(`/test-runs?execution=${result.execution_id}`);
      } else {
        setError('Test execution started but no execution ID was returned. Please check the test runs page.');
      }
    } catch (err: any) {
      // Enhanced error handling
      let errorMessage = 'Failed to run test case';

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Test execution timed out. Please try again or check if the test executor service is running.';
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        errorMessage = 'Network error: Unable to connect to the server. Please check your connection and try again.';
      } else if (err.response?.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error occurred. Please try again later or contact support.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setRunningTestCases(prev => {
        const next = new Set(prev);
        next.delete(testCaseId);
        return next;
      });
    }
  }, [testCasesMap, navigate]);

  const buildFlowGraph = useCallback((projects: FlowData['projects']) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const newTestCasesMap = new Map<string, TestCase>();
    let yPosition = 50;
    const horizontalSpacing = 300;
    const verticalSpacing = 150;

    projects.forEach((projectData, projectIndex) => {
      const project = projectData.project;
      const folders = projectData.folders || [];
      const projectX = 400;
      const projectY = yPosition;

      // Project node
      newNodes.push({
        id: `project-${project.id}`,
        type: 'project',
        position: { x: projectX, y: projectY },
        data: {
          label: project.name,
          description: project.description,
          website_url: project.website_url,
        },
      });

      // Group user stories by folder
      const userStoriesByFolder = new Map<string | null, typeof projectData.user_stories>();
      projectData.user_stories.forEach(us => {
        const folderId = (us.user_story as any).folder_id || null;
        if (!userStoriesByFolder.has(folderId)) {
          userStoriesByFolder.set(folderId, []);
        }
        userStoriesByFolder.get(folderId)!.push(us);
      });

      // Calculate positions for folders and unfiled user stories
      const totalFolders = folders.length;
      const unfiledStories = userStoriesByFolder.get(null) || [];
      const totalTopLevel = totalFolders + unfiledStories.length;

      let folderY = projectY + verticalSpacing;
      let topLevelXStart = projectX - ((totalTopLevel - 1) * horizontalSpacing) / 2;
      let topLevelIndex = 0;

      // Create folder nodes
      folders.forEach((folder, folderIndex) => {
        const folderX = topLevelXStart + topLevelIndex * horizontalSpacing;
        const folderStories = userStoriesByFolder.get(folder.id) || [];

        newNodes.push({
          id: `folder-${folder.id}`,
          type: 'folder',
          position: { x: folderX, y: folderY },
          data: {
            label: folder.name,
            folderId: folder.id,
            color: folder.color,
            userStoryCount: folderStories.length,
          },
        });

        // Edge from project to folder
        newEdges.push({
          id: `edge-project-${project.id}-folder-${folder.id}`,
          source: `project-${project.id}`,
          target: `folder-${folder.id}`,
          type: 'smoothstep',
        });

        // Add user stories under this folder
        let folderUserStoryY = folderY + verticalSpacing;
        let folderUserStoryXStart = folderX - ((folderStories.length - 1) * (horizontalSpacing * 0.8)) / 2;

        folderStories.forEach((userStoryData, usIndex) => {
          const userStory = userStoryData.user_story;
          const userStoryX = folderUserStoryXStart + usIndex * (horizontalSpacing * 0.8);

          newNodes.push({
            id: `userstory-${userStory.id}`,
            type: 'userStory',
            position: { x: userStoryX, y: folderUserStoryY },
            data: {
              label: userStory.story,
              story: userStory.story,
              website_url: userStory.website_url,
              folderId: folder.id,
            },
          });

          // Edge from folder to user story
          newEdges.push({
            id: `edge-folder-${folder.id}-userstory-${userStory.id}`,
            source: `folder-${folder.id}`,
            target: `userstory-${userStory.id}`,
            type: 'smoothstep',
          });
        });

        topLevelIndex++;
      });

      // Create unfiled user stories (directly under project)
      let userStoryY = folderY;
      unfiledStories.forEach((userStoryData, userStoryIndex) => {
        const userStory = userStoryData.user_story;
        const userStoryX = topLevelXStart + topLevelIndex * horizontalSpacing;
        const userStoryYPos = userStoryY;

        // User Story node
        newNodes.push({
          id: `userstory-${userStory.id}`,
          type: 'userStory',
          position: { x: userStoryX, y: userStoryYPos },
          data: {
            label: userStory.story,
            story: userStory.story,
            website_url: userStory.website_url,
          },
        });

        // Edge from project to user story
        newEdges.push({
          id: `edge-project-${project.id}-userstory-${userStory.id}`,
          source: `project-${project.id}`,
          target: `userstory-${userStory.id}`,
          type: 'smoothstep',
        });

        topLevelIndex++;
      });

      // Process all user stories for test suites and test cases
      projectData.user_stories.forEach((userStoryData, userStoryIndex) => {
        const userStory = userStoryData.user_story;
        const userStoryNodeId = `userstory-${userStory.id}`;

        // Find the user story node position
        const usNode = newNodes.find(n => n.id === userStoryNodeId);
        if (!usNode) return;

        const userStoryX = usNode.position.x;
        const userStoryYPos = usNode.position.y;

        let testSuiteY = userStoryYPos + verticalSpacing;
        let testSuiteXStart = userStoryX - ((userStoryData.test_suites.length - 1) * horizontalSpacing) / 2;
        let maxTestSuiteY = testSuiteY;

        // Test Suites
        userStoryData.test_suites.forEach((testSuiteData, testSuiteIndex) => {
          const testSuite = testSuiteData.test_suite;
          const testSuiteX = testSuiteXStart + testSuiteIndex * horizontalSpacing;
          const testSuiteYPos = testSuiteY;

          // Test Suite node
          newNodes.push({
            id: `testsuite-${testSuite.id}`,
            type: 'testSuite',
            position: { x: testSuiteX, y: testSuiteYPos },
            data: {
              label: testSuite.name,
              description: testSuite.description,
            },
          });

          // Edge from user story to test suite
          newEdges.push({
            id: `edge-userstory-${userStory.id}-testsuite-${testSuite.id}`,
            source: `userstory-${userStory.id}`,
            target: `testsuite-${testSuite.id}`,
            type: 'smoothstep',
          });

          let testCaseY = testSuiteYPos + verticalSpacing;
          let testCaseXStart = testSuiteX - ((testSuiteData.test_cases.length - 1) * (horizontalSpacing * 0.8)) / 2;
          let maxTestCaseY = testCaseY;

          // Test Cases in test suite
          testSuiteData.test_cases.forEach((testCaseData, testCaseIndex) => {
            const testCase = testCaseData.test_case;
            const testCaseX = testCaseXStart + testCaseIndex * (horizontalSpacing * 0.8);
            const testCaseYPos = testCaseY;

            // Store test case for running
            newTestCasesMap.set(testCase.id, testCase);

            // Test Case node
            newNodes.push({
              id: `testcase-${testCase.id}`,
              type: 'testCase',
              position: { x: testCaseX, y: testCaseYPos },
              data: {
                label: testCase.name,
                description: testCase.description,
                stepCount: testCase.steps.length,
                testCaseId: testCase.id,
              },
            });

            // Edge from test suite to test case
            newEdges.push({
              id: `edge-testsuite-${testSuite.id}-testcase-${testCase.id}`,
              source: `testsuite-${testSuite.id}`,
              target: `testcase-${testCase.id}`,
              type: 'smoothstep',
            });

            let testStepY = testCaseYPos + verticalSpacing;
            let testStepXStart = testCaseX - ((testCase.steps.length - 1) * (horizontalSpacing * 0.6)) / 2;

            // Test Steps
            testCase.steps.forEach((step, stepIndex) => {
              const testStepX = testStepXStart + stepIndex * (horizontalSpacing * 0.6);
              const testStepYPos = testStepY;

              // Test Step node
              newNodes.push({
                id: `teststep-${testCase.id}-${step.id}`,
                type: 'testStep',
                position: { x: testStepX, y: testStepYPos },
                data: {
                  label: step.description || `Step ${stepIndex + 1}`,
                  action: step.action,
                  description: step.description,
                },
              });

              // Edge from test case to test step
              newEdges.push({
                id: `edge-testcase-${testCase.id}-teststep-${step.id}`,
                source: `testcase-${testCase.id}`,
                target: `teststep-${testCase.id}-${step.id}`,
                type: 'smoothstep',
              });
            });

            // Update testCaseY for next test case
            if (testCase.steps.length > 0) {
              testCaseY = testCaseYPos + verticalSpacing + (testCase.steps.length * 50);
            } else {
              testCaseY = testCaseYPos + verticalSpacing;
            }
            maxTestCaseY = Math.max(maxTestCaseY, testCaseY);
          });

          // Update testSuiteY for next test suite
          testSuiteY = Math.max(testSuiteY, maxTestCaseY);
          maxTestSuiteY = Math.max(maxTestSuiteY, testSuiteY);
        });

        // Test Cases directly under user story (without test suite)
        let directTestCaseY = userStoryYPos + verticalSpacing;
        if (userStoryData.test_suites.length > 0) {
          directTestCaseY = maxTestSuiteY + verticalSpacing;
        }

        if (userStoryData.test_cases && userStoryData.test_cases.length > 0) {
          let directTestCaseXStart = userStoryX - ((userStoryData.test_cases.length - 1) * (horizontalSpacing * 0.8)) / 2;

          userStoryData.test_cases.forEach((testCaseData, testCaseIndex) => {
            const testCase = testCaseData.test_case;
            const testCaseX = directTestCaseXStart + testCaseIndex * (horizontalSpacing * 0.8);
            const testCaseYPos = directTestCaseY;

            // Store test case for running
            newTestCasesMap.set(testCase.id, testCase);

            // Test Case node
            newNodes.push({
              id: `testcase-${testCase.id}`,
              type: 'testCase',
              position: { x: testCaseX, y: testCaseYPos },
              data: {
                label: testCase.name,
                description: testCase.description,
                stepCount: testCase.steps.length,
                testCaseId: testCase.id,
              },
            });

            // Edge from user story to test case
            newEdges.push({
              id: `edge-userstory-${userStory.id}-testcase-${testCase.id}`,
              source: `userstory-${userStory.id}`,
              target: `testcase-${testCase.id}`,
              type: 'smoothstep',
            });

            let testStepY = testCaseYPos + verticalSpacing;
            let testStepXStart = testCaseX - ((testCase.steps.length - 1) * (horizontalSpacing * 0.6)) / 2;

            // Test Steps
            testCase.steps.forEach((step, stepIndex) => {
              const testStepX = testStepXStart + stepIndex * (horizontalSpacing * 0.6);
              const testStepYPos = testStepY;

              // Test Step node
              newNodes.push({
                id: `teststep-${testCase.id}-${step.id}`,
                type: 'testStep',
                position: { x: testStepX, y: testStepYPos },
                data: {
                  label: step.description || `Step ${stepIndex + 1}`,
                  action: step.action,
                  description: step.description,
                },
              });

              // Edge from test case to test step
              newEdges.push({
                id: `edge-testcase-${testCase.id}-teststep-${step.id}`,
                source: `testcase-${testCase.id}`,
                target: `teststep-${testCase.id}-${step.id}`,
                type: 'smoothstep',
              });
            });
          });
        }

        // Update userStoryY for next user story
        let maxY = userStoryYPos + verticalSpacing;
        if (userStoryData.test_suites.length > 0) {
          maxY = Math.max(maxY, maxTestSuiteY + verticalSpacing);
        }
        if (userStoryData.test_cases && userStoryData.test_cases.length > 0) {
          // Calculate max Y for direct test cases
          let maxDirectTestCaseY = directTestCaseY;
          userStoryData.test_cases.forEach((testCaseData) => {
            const testCase = testCaseData.test_case;
            if (testCase.steps.length > 0) {
              maxDirectTestCaseY = Math.max(maxDirectTestCaseY, directTestCaseY + verticalSpacing + (testCase.steps.length * 50));
            } else {
              maxDirectTestCaseY = Math.max(maxDirectTestCaseY, directTestCaseY + verticalSpacing);
            }
          });
          maxY = Math.max(maxY, maxDirectTestCaseY + verticalSpacing);
        }
        userStoryY = maxY;
      });

      // Update yPosition for next project
      yPosition = Math.max(yPosition, userStoryY + verticalSpacing * 2);
    });

    // Store all nodes and edges - filtering will happen in the useEffect
    setAllNodes(newNodes);
    setAllEdges(newEdges);
    setTestCasesMap(newTestCasesMap);
  }, []); // State setters are stable, no need to include in deps

  const fetchFlowData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFlowData();
      setFlowData(response.projects);
      buildFlowGraph(response.projects);
    } catch (err: any) {
      let errorMessage = 'Failed to load architecture flow data';

      if (err.code === 'ERR_NETWORK' || !err.response) {
        errorMessage = 'Network error: Unable to connect to the server. Please check your connection.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [buildFlowGraph]);

  // Handle folder creation/update
  const handleFolderSubmit = useCallback(async (data: { name: string; color: string }) => {
    if (!selectedProjectId) {
      throw new Error('No project selected');
    }

    try {
      if (editingFolder) {
        await updateFolder(editingFolder.id, data);
      } else {
        await createFolder(selectedProjectId, data);
      }

      // Refresh flow data
      await fetchFlowData();
    } catch (err: any) {
      let errorMessage = editingFolder ? 'Failed to update folder' : 'Failed to create folder';

      if (err.code === 'ERR_NETWORK' || !err.response) {
        errorMessage = 'Network error: Unable to connect to the server.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      throw new Error(errorMessage);
    }
  }, [selectedProjectId, editingFolder, fetchFlowData]);

  const openCreateFolderModal = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setEditingFolder(null);
    setFolderModalOpen(true);
  }, []);

  useEffect(() => {
    fetchFlowData();
  }, [fetchFlowData]);

  // Initialize folder expansion state when flow data is loaded
  useEffect(() => {
    if (flowData.length > 0 && expandedFolders.size === 0) {
      const allFolderIds: string[] = [];
      flowData.forEach(projectData => {
        const folders = projectData.folders || [];
        folders.forEach(folder => {
          allFolderIds.push(folder.id);
        });
      });
      if (allFolderIds.length > 0) {
        setExpandedFolders(new Set(allFolderIds));
      }
    }
  }, [flowData, expandedFolders.size]);

  // Filter nodes and edges based on visibility and expansion state
  useEffect(() => {
    // Build a map of user story folder assignments for quick lookup
    const userStoryFolderMap = new Map<string, string>();
    allNodes.forEach(node => {
      if (node.type === 'userStory' && node.data.folderId) {
        userStoryFolderMap.set(node.id, node.data.folderId);
      }
    });

    // Filter nodes based on visibility and expansion
    const filteredNodes = allNodes.filter(node => {
      const nodeType = node.type as FlowNodeType;

      // Check if node type is visible
      if (!visibleTypes.has(nodeType)) {
        return false;
      }

      // For user stories in folders, check if folder is expanded
      if (nodeType === 'userStory' && node.data.folderId) {
        const folderId = node.data.folderId;
        if (!expandedFolders.has(folderId)) {
          return false;
        }
      }

      // For test steps, also check if parent test case is expanded
      if (nodeType === 'testStep') {
        // Node id format: teststep-{testCaseId}-{stepId}
        const parts = node.id.split('-');
        const testCaseId = parts[1];
        return expandedTestCases.has(testCaseId);
      }

      return true;
    });

    // Update nodes with expansion state and handlers
    const updatedNodes = filteredNodes.map(node => {
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

    // Filter edges - only show edges where both source and target are visible
    const visibleNodeIds = new Set(updatedNodes.map(n => n.id));
    const filteredEdges = allEdges.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    setNodes(updatedNodes);
    setEdges(filteredEdges);
  }, [allNodes, allEdges, visibleTypes, expandedFolders, expandedTestCases, runningTestCases, handleToggleFolderExpand, handleToggleExpand, handleRunTestCase, setNodes, setEdges]);

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

  // Get first project ID for folder creation (for demo purposes)
  const firstProjectId = flowData.length > 0 ? flowData[0].project.id : null;

  return (
    <div className="h-full w-full">
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Architecture Flow</h1>
          <p className="text-sm text-gray-600 mt-1">
            Visual representation of projects, user stories, test suites, test cases, and test steps
          </p>
        </div>
        {firstProjectId && (
          <Button
            onClick={() => openCreateFolderModal(firstProjectId)}
            variant="primary"
            size="sm"
          >
            <FiFolderPlus className="inline mr-2" />
            Create Folder
          </Button>
        )}
      </div>
      <div className="h-[calc(100vh-120px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Controls />
          <Background />
          <MiniMap />
          <Panel position="top-right" className="bg-white p-3 rounded-lg shadow-lg">
            <div className="text-xs font-semibold text-gray-700 mb-2">Visibility Filters</div>
            <div className="text-sm space-y-2">
              <label
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                onClick={() => toggleVisibility('project')}
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has('project')}
                  onChange={() => toggleVisibility('project')}
                  className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
                <span>Project</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                onClick={() => toggleVisibility('folder')}
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has('folder')}
                  onChange={() => toggleVisibility('folder')}
                  className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="w-4 h-4 bg-indigo-100 border-2 border-indigo-300 rounded"></div>
                <span>Folder</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                onClick={() => toggleVisibility('userStory')}
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has('userStory')}
                  onChange={() => toggleVisibility('userStory')}
                  className="rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
                <span>User Story</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                onClick={() => toggleVisibility('testSuite')}
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has('testSuite')}
                  onChange={() => toggleVisibility('testSuite')}
                  className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                />
                <div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded"></div>
                <span>Test Suite</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                onClick={() => toggleVisibility('testCase')}
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has('testCase')}
                  onChange={() => toggleVisibility('testCase')}
                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
                <span>Test Case</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                onClick={() => toggleVisibility('testStep')}
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has('testStep')}
                  onChange={() => toggleVisibility('testStep')}
                  className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                />
                <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                <span>Test Step</span>
              </label>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Click test cases to expand/collapse steps
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

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
