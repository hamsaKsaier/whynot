import React, { useState, useEffect } from 'react';
import { getSystemSettings, updateSystemSetting } from '../services/api';
import { FiSave, FiCheck } from 'react-icons/fi';

export const SystemSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemSettings().then((data) => {
      setSettings(data.settings || []);
      const vals: Record<string, string> = {};
      (data.settings || []).forEach((s: any) => { vals[s.key] = s.value; });
      setEditValues(vals);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await updateSystemSetting(key, editValues[key]);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (err: any) {
      alert(`Failed to save: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Group settings by category
  const groups: Record<string, any[]> = {};
  settings.forEach((s) => {
    const category = s.key.startsWith('credit_cost.') ? 'Credit Costs' : 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push(s);
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-700 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">System Settings</h1>

      {Object.entries(groups).map(([category, items]) => (
        <div key={category} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-3 bg-slate-900 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-200 uppercase">{category}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((setting: any) => (
              <div key={setting.key} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white font-mono">{setting.key}</p>
                  {setting.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{setting.description}</p>
                  )}
                </div>
                <input
                  value={editValues[setting.key] || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                  className="w-48 px-3 py-1.5 border border-slate-600 rounded-lg text-sm"
                />
                <button
                  onClick={() => handleSave(setting.key)}
                  disabled={saving === setting.key || editValues[setting.key] === setting.value}
                  className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-30"
                  title="Save"
                >
                  {saved === setting.key ? (
                    <FiCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <FiSave className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
