import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFilter, FiSearch, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import type { ExecutionResult } from '../types';

export const TestRunsPage: React.FC = () => {
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');

  useEffect(() => {
    // TODO: Fetch executions from API
    // For now, show empty state
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <FiXCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <FiClock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <FiClock className="h-5 w-5 text-gray-400" />;
    }
  };

  const filteredExecutions = executions.filter((exec) => {
    const matchesSearch = exec.execution_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || exec.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Test Runs</h1>
        <p className="text-gray-600 mt-1">View execution history and results</p>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search executions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {filteredExecutions.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No test runs found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredExecutions.map((execution) => (
            <Card key={execution.execution_id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(execution.status)}
                  <div>
                    <div className="font-medium text-gray-900">
                      Execution {execution.execution_id.substring(0, 8)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(execution.started_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-sm">
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-medium">{execution.total_duration_ms}ms</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Steps:</span>
                    <span className="ml-2 font-medium">
                      {execution.steps.filter((s) => s.success).length}/
                      {execution.steps.length}
                    </span>
                  </div>
                  <Link
                    to={`/test-runs/${execution.execution_id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};














