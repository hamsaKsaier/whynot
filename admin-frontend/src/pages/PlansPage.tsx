import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminPlans, archivePlan, restorePlan, syncPlanToStripe } from '../services/api';
import { FiPlus, FiEdit2, FiArchive, FiRefreshCw, FiUploadCloud } from 'react-icons/fi';

export const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await getAdminPlans();
      setPlans(data.plans || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleArchive = async (id: string) => {
    await archivePlan(id);
    await fetchPlans();
  };

  const handleRestore = async (id: string) => {
    await restorePlan(id);
    await fetchPlans();
  };

  const handleSyncStripe = async (id: string) => {
    try {
      await syncPlanToStripe(id);
      await fetchPlans();
      alert('Plan synced to Stripe successfully');
    } catch (err: any) {
      alert(`Stripe sync failed: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
        <Link
          to="/plans/new"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <FiPlus className="mr-2 h-4 w-4" /> New Plan
        </Link>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan: any) => (
            <div key={plan.id} className={`bg-white rounded-lg border p-5 ${plan.is_archived ? 'border-gray-300 opacity-60' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    {plan.is_archived && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Archived</span>
                    )}
                    {!plan.is_public && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Hidden</span>
                    )}
                    {plan.is_custom && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {plan.price_cents === 0 ? 'Free' : `$${(plan.price_cents / 100).toFixed(2)}/${plan.billing_interval}`}
                    {' '} | {plan.credits_per_period} credits
                    {plan.trial_days > 0 && ` | ${plan.trial_days}-day trial`}
                    {' '} | {plan.subscriber_count || 0} subscribers
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncStripe(plan.id)}
                    className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                    title="Sync to Stripe"
                  >
                    <FiUploadCloud className="h-4 w-4" />
                  </button>
                  <Link
                    to={`/plans/${plan.id}/edit`}
                    className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                    title="Edit"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </Link>
                  {plan.is_archived ? (
                    <button
                      onClick={() => handleRestore(plan.id)}
                      className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-gray-100"
                      title="Restore"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArchive(plan.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                      title="Archive"
                    >
                      <FiArchive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Features */}
              {plan.features && plan.features.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.features.map((f: any) => (
                    <span key={f.feature_key} className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {f.feature_key}: {f.feature_value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
