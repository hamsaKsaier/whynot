import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAdminPlan, createPlan, updatePlan, setPlanFeatures } from '../services/api';
import { FiPlus, FiX } from 'react-icons/fi';

export const PlanEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_cents: 0,
    billing_interval: 'monthly' as 'monthly' | 'yearly' | 'one_time',
    credits_per_period: 0,
    trial_days: 0,
    is_custom: false,
    is_public: true,
    sort_order: 0,
  });

  const [features, setFeatures] = useState<Array<{ key: string; value: string }>>([]);
  const [newFeatureKey, setNewFeatureKey] = useState('');
  const [newFeatureValue, setNewFeatureValue] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getAdminPlan(id).then((data) => {
        const p = data.plan;
        setForm({
          name: p.name,
          slug: p.slug,
          description: p.description || '',
          price_cents: p.price_cents,
          billing_interval: p.billing_interval,
          credits_per_period: p.credits_per_period,
          trial_days: p.trial_days || 0,
          is_custom: p.is_custom,
          is_public: p.is_public,
          sort_order: p.sort_order || 0,
        });
        setFeatures(
          (p.features || []).map((f: any) => ({ key: f.feature_key, value: f.feature_value }))
        );
        setLoading(false);
      });
    }
  }, [id]);

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      ...(isNew ? { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') } : {}),
    }));
  };

  const addFeature = () => {
    if (!newFeatureKey) return;
    setFeatures(prev => [...prev, { key: newFeatureKey, value: newFeatureValue || 'true' }]);
    setNewFeatureKey('');
    setNewFeatureValue('');
  };

  const removeFeature = (index: number) => {
    setFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let planId = id;
      if (isNew) {
        const result = await createPlan(form);
        planId = result.plan.id;
      } else {
        await updatePlan(id!, form);
      }

      // Save features
      if (planId && features.length > 0) {
        const featureMap: Record<string, string> = {};
        features.forEach(f => { featureMap[f.key] = f.value; });
        await setPlanFeatures(planId, featureMap);
      }

      navigate('/plans');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isNew ? 'Create Plan' : 'Edit Plan'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
                pattern="[a-z0-9-]+"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (cents)</label>
              <input
                type="number"
                value={form.price_cents}
                onChange={(e) => setForm(prev => ({ ...prev, price_cents: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Interval</label>
              <select
                value={form.billing_interval}
                onChange={(e) => setForm(prev => ({ ...prev, billing_interval: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credits / Period</label>
              <input
                type="number"
                value={form.credits_per_period}
                onChange={(e) => setForm(prev => ({ ...prev, credits_per_period: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
              <input
                type="number"
                value={form.trial_days}
                onChange={(e) => setForm(prev => ({ ...prev, trial_days: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center text-sm">
                <input type="checkbox" checked={form.is_public} onChange={(e) => setForm(prev => ({ ...prev, is_public: e.target.checked }))} className="mr-2" />
                Public
              </label>
              <label className="flex items-center text-sm">
                <input type="checkbox" checked={form.is_custom} onChange={(e) => setForm(prev => ({ ...prev, is_custom: e.target.checked }))} className="mr-2" />
                Custom (Enterprise)
              </label>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Flags</h2>

          <div className="space-y-2 mb-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-mono bg-gray-50 px-3 py-1.5 rounded">{f.key}</span>
                <span className="text-sm font-mono bg-gray-50 px-3 py-1.5 rounded w-32">{f.value}</span>
                <button type="button" onClick={() => removeFeature(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Key</label>
              <input
                value={newFeatureKey}
                onChange={(e) => setNewFeatureKey(e.target.value)}
                placeholder="max_projects"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-gray-500">Value</label>
              <input
                value={newFeatureValue}
                onChange={(e) => setNewFeatureValue(e.target.value)}
                placeholder="true"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button type="button" onClick={addFeature} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              <FiPlus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/plans')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : isNew ? 'Create Plan' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
