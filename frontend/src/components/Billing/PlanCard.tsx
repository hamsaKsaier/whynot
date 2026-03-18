import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { FiCheck } from 'react-icons/fi';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number;
    credits_per_period: number;
    billing_interval: string;
    is_custom: boolean;
    features: Record<string, string>;
  };
  isCurrentPlan: boolean;
  onUpgrade: () => void;
  disabled?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, isCurrentPlan, onUpgrade, disabled }) => {
  const price = plan.price_cents / 100;
  const interval = plan.billing_interval === 'yearly' ? '/yr' : '/mo';

  const featureLabels: Record<string, string> = {
    qa_loop: 'QA Loop',
    visual_regression: 'Visual Regression',
    webhooks: 'Notifications',
    api_access: 'API Access',
    priority_support: 'Priority Support',
  };

  const enabledFeatures = Object.entries(plan.features)
    .filter(([key, val]) => val === 'true' && featureLabels[key])
    .map(([key]) => featureLabels[key]);

  return (
    <Card className={`p-5 flex flex-col ${isCurrentPlan ? 'ring-2 ring-primary-500' : ''}`}>
      {isCurrentPlan && (
        <div className="text-xs font-semibold text-primary-600 uppercase mb-2">Current Plan</div>
      )}
      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
      <p className="text-sm text-gray-500 mt-1 flex-1">{plan.description}</p>

      <div className="mt-4">
        {plan.is_custom ? (
          <span className="text-2xl font-bold text-gray-900">Custom</span>
        ) : plan.price_cents === 0 ? (
          <span className="text-2xl font-bold text-gray-900">Free</span>
        ) : (
          <div>
            <span className="text-2xl font-bold text-gray-900">${price}</span>
            <span className="text-sm text-gray-500">{interval}</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-600">
        {plan.credits_per_period > 0
          ? `${plan.credits_per_period.toLocaleString()} credits${interval}`
          : 'Custom credits'}
      </div>

      <ul className="mt-4 space-y-2">
        {enabledFeatures.map((f) => (
          <li key={f} className="flex items-center text-sm text-gray-700">
            <FiCheck className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
            {f}
          </li>
        ))}
        {plan.features.max_projects && (
          <li className="flex items-center text-sm text-gray-700">
            <FiCheck className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
            {plan.features.max_projects === '-1' ? 'Unlimited' : plan.features.max_projects} projects
          </li>
        )}
      </ul>

      <div className="mt-4">
        {isCurrentPlan ? (
          <Button variant="secondary" disabled className="w-full">Current Plan</Button>
        ) : plan.is_custom ? (
          <Button variant="secondary" className="w-full" onClick={() => window.open('mailto:sales@whynot.dev')}>
            Contact Sales
          </Button>
        ) : plan.price_cents === 0 ? (
          <Button variant="secondary" disabled className="w-full">Free Trial</Button>
        ) : (
          <Button onClick={onUpgrade} disabled={disabled} className="w-full">
            Upgrade
          </Button>
        )}
      </div>
    </Card>
  );
};
