import React, { useState } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiGlobe } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

interface Environment {
  id: string;
  name: string;
  url: string;
  description?: string;
}

export const EnvironmentsPage: React.FC = () => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save environment
    const newEnv: Environment = {
      id: Date.now().toString(),
      ...formData,
    };
    setEnvironments([...environments, newEnv]);
    setFormData({ name: '', url: '', description: '' });
    setShowAddForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Environments</h1>
          <p className="text-gray-600 mt-1">Manage test environments and URLs</p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2"
        >
          <FiPlus className="h-4 w-4" />
          <span>New Environment</span>
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Environment Name
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production, Staging"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL
              </label>
              <Input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button type="submit">Save Environment</Button>
              <Button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', url: '', description: '' });
                }}
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {environments.length === 0 ? (
        <Card className="text-center py-12">
          <FiGlobe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No environments configured</p>
          <Button onClick={() => setShowAddForm(true)}>Create Environment</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((env) => (
            <Card key={env.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{env.name}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <FiEdit className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2 break-all">{env.url}</p>
              {env.description && (
                <p className="text-xs text-gray-500">{env.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

























