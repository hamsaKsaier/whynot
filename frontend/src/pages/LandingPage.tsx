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
    <div className="min-h-screen bg-navy-900 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-navy-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="WhyNot" className="h-8" />
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-gray-400 hover:text-white">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white">Pricing</a>
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/qa-loop')}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-sm font-medium text-primary-400 hover:text-primary-300"
                >
                  Log in
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 text-primary-400 text-sm font-medium mb-6">
            <FiZap className="h-3 w-3" />
            Autonomous QA — no scripts, no setup
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            Drop in a URL.<br />
            <span className="bg-gradient-to-r from-primary-400 to-primary-500 bg-clip-text text-transparent">
              Get a QA team.
            </span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            WhyNot crawls your app, generates tests, finds bugs, fixes your code, and opens a PR —
            all autonomously. Just paste a URL.
          </p>

          {/* Scan Form */}
          <form onSubmit={handleScan} className="max-w-xl mx-auto">
            <div className="flex items-stretch bg-navy-800 border-2 border-navy-700 rounded-xl shadow-lg focus-within:border-primary-500 transition-colors">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://your-app.com"
                className="flex-1 px-5 py-4 text-lg bg-transparent outline-none rounded-l-xl text-white placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={scanning || !url}
                className="px-6 py-4 bg-emerald-500 text-white font-semibold rounded-r-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
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
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}
            <p className="mt-3 text-xs text-gray-500">
              3 free scans per day. No account needed.
            </p>
          </form>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-navy-800 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
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
              <div key={item.step} className="relative bg-navy-700 rounded-xl p-6 shadow-sm border border-navy-700">
                <div className="w-10 h-10 bg-primary-500/10 rounded-full flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-primary-400" />
                </div>
                <div className="absolute top-4 right-4 w-8 h-8 bg-navy-900 rounded-full flex items-center justify-center text-sm font-bold text-gray-500">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">
            Everything you need for autonomous QA
          </h2>
          <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
            Replace manual testing with an AI that never sleeps.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: FiZap,
                title: 'Autonomous QA Loop',
                desc: 'AI crawls your app, generates tests, runs them, finds bugs, and iterates — all without writing a single test.',
                color: 'sky',
              },
              {
                icon: FiGitPullRequest,
                title: 'Auto-Fix + PR',
                desc: 'Found a bug? WhyNot reads your code on GitHub, generates a fix, opens a PR, retests, and iterates until the bug is gone.',
                color: 'emerald',
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
                color: 'amber',
              },
              {
                icon: FiTrendingUp,
                title: 'Quality Score',
                desc: 'Track your app quality over time with a single metric. Set thresholds and get alerted on regressions.',
                color: 'teal',
              },
            ].map((feature) => {
              const colors: Record<string, string> = {
                sky: 'bg-sky-500/10 text-sky-400',
                emerald: 'bg-emerald-500/10 text-emerald-400',
                red: 'bg-red-500/10 text-red-400',
                blue: 'bg-blue-500/10 text-blue-400',
                amber: 'bg-amber-500/10 text-amber-400',
                teal: 'bg-teal-500/10 text-teal-400',
              };
              return (
                <div key={feature.title} className="p-6 rounded-xl border border-navy-700 hover:border-navy-700 hover:shadow-md transition-shadow bg-navy-800">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${colors[feature.color]}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-navy-800 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-gray-400 mb-12">
            Start free. Scale as you grow.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.length > 0 ? plans.map((plan) => {
              const isPopular = plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('team');
              return (
                <div
                  key={plan.id}
                  className={`relative bg-navy-900 rounded-xl p-6 shadow-sm border ${isPopular ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-navy-700'}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-500 text-white text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">
                      {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
                    </span>
                    {plan.price_monthly > 0 && <span className="text-gray-400 text-sm">/mo</span>}
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    {plan.monthly_credits.toLocaleString()} credits/month
                  </p>
                  <ul className="space-y-2 mb-6">
                    {Object.entries(plan.features || {}).slice(0, 5).map(([key, val]) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {typeof val === 'number' && val > 0 ? `: ${val}` : ''}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                      isPopular
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-navy-700 text-gray-300 hover:bg-navy-700/80'
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
                  className={`relative bg-navy-900 rounded-xl p-6 shadow-sm border ${i === 1 ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-navy-700'}`}
                >
                  {i === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-500 text-white text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    {plan.price !== 'Free' && <span className="text-gray-400 text-sm">/mo</span>}
                  </div>
                  <p className="text-sm text-gray-400 mb-4">{plan.credits} credits/month</p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                      i === 1
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-navy-700 text-gray-300 hover:bg-navy-700/80'
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
          <h2 className="text-3xl font-bold text-white mb-4">
            Stop writing tests. Start shipping quality.
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            WhyNot is the QA team you always wanted but never had the budget for.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors text-lg"
          >
            Try it free
            <FiArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-700 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="WhyNot" className="h-6" />
          </div>
          <p className="text-xs text-gray-500">
            Autonomous QA Platform
          </p>
        </div>
      </footer>
    </div>
  );
};
