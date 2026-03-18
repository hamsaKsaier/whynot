import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiZap, FiGitPullRequest, FiShield, FiEye, FiArrowRight, FiCheckCircle, FiClock, FiTrendingUp } from 'react-icons/fi';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface PlanInfo {
  id: string;
  name: string;
  monthly_credits: number;
  price_monthly: number;
  features: Record<string, any>;
}

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<PlanInfo[]>([]);

  const isLoggedIn = !!localStorage.getItem('auth_token');

  useEffect(() => {
    // Load public plans
    fetch(`${API_BASE}/public/plans`)
      .then(r => r.json())
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Normalize URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    setError('');
    setScanning(true);

    try {
      const res = await fetch(`${API_BASE}/public/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, email: email || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Scan failed (${res.status})`);
      }

      const data = await res.json();
      if (data.sessionId) {
        navigate(`/scan/${data.sessionId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <FiZap className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">WhyNot</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/qa-loop')}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Log in
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Sign up free
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm font-medium mb-6">
            <FiZap className="h-3 w-3" />
            Autonomous QA — no scripts, no setup
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Drop in a URL.<br />
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Get a QA team.
            </span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            WhyNot crawls your app, generates tests, finds bugs, fixes your code, and opens a PR —
            all autonomously. Just paste a URL.
          </p>

          {/* Scan Form */}
          <form onSubmit={handleScan} className="max-w-xl mx-auto">
            <div className="flex items-stretch bg-white border-2 border-gray-200 rounded-xl shadow-lg focus-within:border-purple-400 transition-colors">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://your-app.com"
                className="flex-1 px-5 py-4 text-lg bg-transparent outline-none rounded-l-xl"
              />
              <button
                type="submit"
                disabled={scanning || !url}
                className="px-6 py-4 bg-purple-600 text-white font-semibold rounded-r-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {scanning ? (
                  <>
                    <FiSearch className="h-5 w-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FiSearch className="h-5 w-5" />
                    Free Scan
                  </>
                )}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional — get results sent to you)"
                className="text-sm text-gray-500 bg-transparent outline-none text-center w-72"
              />
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-500">{error}</p>
            )}
            <p className="mt-3 text-xs text-gray-400">
              3 free scans per day. No account needed.
            </p>
          </form>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: FiSearch,
                title: 'Paste a URL',
                desc: 'WhyNot crawls your app like a real user — clicking, scrolling, filling forms.',
              },
              {
                step: '2',
                icon: FiZap,
                title: 'AI finds bugs',
                desc: 'Autonomous QA agent generates tests, catches bugs, and reports with screenshots.',
              },
              {
                step: '3',
                icon: FiGitPullRequest,
                title: 'Auto-fix & PR',
                desc: 'WhyNot fixes the code, opens a PR, retests, and iterates until quality target is met.',
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-purple-600" />
                </div>
                <div className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-400">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Everything you need for autonomous QA
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            Replace manual testing with an AI that never sleeps.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: FiZap,
                title: 'Autonomous QA Loop',
                desc: 'AI crawls your app, generates tests, runs them, finds bugs, and iterates — all without writing a single test.',
                color: 'purple',
              },
              {
                icon: FiGitPullRequest,
                title: 'Auto-Fix + PR',
                desc: 'Found a bug? WhyNot reads your code on GitHub, generates a fix, opens a PR, retests, and iterates until the bug is gone.',
                color: 'green',
              },
              {
                icon: FiShield,
                title: 'Chaos Testing',
                desc: 'Inject random failures, slow networks, and edge cases. Find breaking points before your users do.',
                color: 'red',
              },
              {
                icon: FiEye,
                title: 'Visual Regression',
                desc: 'Pixel-perfect screenshot comparison catches UI regressions across browsers and viewports.',
                color: 'blue',
              },
              {
                icon: FiClock,
                title: 'Scheduled Monitoring',
                desc: 'Run QA scans on a schedule — daily, weekly, on every deploy. Know about issues before your customers.',
                color: 'orange',
              },
              {
                icon: FiTrendingUp,
                title: 'Quality Score',
                desc: 'Track your app quality over time with a single metric. Set thresholds and get alerted on regressions.',
                color: 'teal',
              },
            ].map((feature) => {
              const colors: Record<string, string> = {
                purple: 'bg-purple-50 text-purple-600',
                green: 'bg-green-50 text-green-600',
                red: 'bg-red-50 text-red-600',
                blue: 'bg-blue-50 text-blue-600',
                orange: 'bg-orange-50 text-orange-600',
                teal: 'bg-teal-50 text-teal-600',
              };
              return (
                <div key={feature.title} className="p-6 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${colors[feature.color]}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-50 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-gray-500 mb-12">
            Start free. Scale as you grow.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.length > 0 ? plans.map((plan) => {
              const isPopular = plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('team');
              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-xl p-6 shadow-sm border ${isPopular ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-200'}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
                    </span>
                    {plan.price_monthly > 0 && <span className="text-gray-500 text-sm">/mo</span>}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    {plan.monthly_credits.toLocaleString()} credits/month
                  </p>
                  <ul className="space-y-2 mb-6">
                    {Object.entries(plan.features || {}).slice(0, 5).map(([key, val]) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-gray-600">
                        <FiCheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {typeof val === 'number' && val > 0 ? `: ${val}` : ''}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                      isPopular
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Get Started
                  </button>
                </div>
              );
            }) : (
              /* Fallback pricing if API is not ready */
              [
                { name: 'Free', price: 'Free', credits: '50', features: ['3 QA Loop sessions', 'Basic bug reports', 'Community support'] },
                { name: 'Pro', price: '$49', credits: '500', features: ['Unlimited QA sessions', 'Auto-fix + PR', 'Scheduled monitoring', 'Priority support'] },
                { name: 'Team', price: '$149', credits: '2,000', features: ['Everything in Pro', 'CI Integration', 'Team workspaces', 'Custom quality gates'] },
              ].map((plan, i) => (
                <div
                  key={plan.name}
                  className={`relative bg-white rounded-xl p-6 shadow-sm border ${i === 1 ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-200'}`}
                >
                  {i === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    {plan.price !== 'Free' && <span className="text-gray-500 text-sm">/mo</span>}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{plan.credits} credits/month</p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <FiCheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                      i === 1
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Get Started
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Stop writing tests. Start shipping quality.
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            WhyNot is the QA team you always wanted but never had the budget for.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors text-lg"
          >
            Try it free
            <FiArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 rounded flex items-center justify-center">
              <FiZap className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">WhyNot</span>
          </div>
          <p className="text-xs text-gray-400">
            Autonomous QA Platform
          </p>
        </div>
      </footer>
    </div>
  );
};
