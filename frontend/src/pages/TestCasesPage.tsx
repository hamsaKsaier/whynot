import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiPlay, FiEdit, FiTrash2, FiSave, FiX, FiGlobe } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Alert } from '../components/common/Alert';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { getTestCases, updateTestCase, deleteTestCase } from '../services/api';
import type { TestCase } from '../types';

export const TestCasesPage: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; testCase: TestCase | null }>({
    isOpen: false,
    testCase: null,
  });
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTestCases();
      setTestCases(response.test_cases);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch test cases');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingId(testCase.id);
    setEditName(testCase.name);
    setEditDescription(testCase.description || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const updated = await updateTestCase(id, {
        name: editName,
        description: editDescription,
      });
      setTestCases(testCases.map(tc => tc.id === id ? updated : tc));
      setEditingId(null);
      setEditName('');
      setEditDescription('');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update test case');
    }
  };

  const handleDeleteClick = (testCase: TestCase) => {
    setDeleteConfirm({ isOpen: true, testCase });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.testCase) return;

    try {
      await deleteTestCase(deleteConfirm.testCase.id);
      setTestCases(testCases.filter(tc => tc.id !== deleteConfirm.testCase!.id));
      setDeleteConfirm({ isOpen: false, testCase: null });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete test case');
      setDeleteConfirm({ isOpen: false, testCase: null });
    }
  };

  const handleRunTest = async (testCase: TestCase) => {
    setRunningTestId(testCase.id);
    setError(null);
    try {
      // Navigate to home page with test case to execute
      navigate('/', { state: { testCase, execute: true, headless: false } });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to run test');
      setRunningTestId(null);
    }
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Test Cases</h1>
          <p className="text-gray-600 mt-1">Manage and execute your saved test cases</p>
        </div>
        <Button 
          className="flex items-center space-x-2"
          onClick={() => navigate('/')}
        >
          <FiPlus className="h-4 w-4" />
          <span>New Test Case</span>
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {loading && testCases.length === 0 ? (
        <Card className="text-center py-12">
          <div className="flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-3 text-gray-600">Loading test cases...</span>
          </div>
        </Card>
      ) : testCases.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500 mb-4">No test cases yet</p>
          <Button onClick={() => navigate('/')}>Create Your First Test Case</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testCases.map((testCase) => {
            const isEditing = editingId === testCase.id;
            const isRunning = runningTestId === testCase.id;

            return (
              <Card key={testCase.id} className="p-4 hover:shadow-lg transition-shadow">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Test case name"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      rows={3}
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(testCase.id)}
                        className="flex-1"
                      >
                        <FiSave className="mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        <FiX className="mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-2">{testCase.name}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {testCase.description || 'No description'}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 mb-3">
                      <FiGlobe className="h-3 w-3 mr-1" />
                      <span className="truncate">{testCase.website_url}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-xs text-gray-500">
                        {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRunTest(testCase)}
                          disabled={isRunning}
                          className="p-2 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Run test"
                        >
                          <FiPlay className={`h-4 w-4 ${isRunning ? 'text-gray-400' : 'text-primary-600'}`} />
                        </button>
                        <button
                          onClick={() => handleEdit(testCase)}
                          className="p-2 rounded hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <FiEdit className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(testCase)}
                          className="p-2 rounded hover:bg-gray-100 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Test Case"
        message={`Are you sure you want to delete "${deleteConfirm.testCase?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, testCase: null })}
      />
    </div>
  );
};
