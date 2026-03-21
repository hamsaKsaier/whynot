import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiGlobe,
  FiSearch,
  FiFileText,
  FiZap,
  FiCamera,
  FiCode,
  FiClock,
  FiArrowRight,
  FiCheckCircle,
  FiArrowDown,
} from 'react-icons/fi';

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
  const [plans, setPlans] = useState<PlanInfo[]>([]);

  const isLoggedIn = !!localStorage.getItem('auth_token');

  useEffect(() => {
    fetch(`${API_BASE}/public/plans`)
      .then(r => r.json())
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-gray-100">
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="WhyNot" className="h-8" />
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollToSection('how-it-works')} className="text-sm text-slate-400 hover:text-white transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('features')} className="text-sm text-slate-400 hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollToSection('pricing')} className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</button>
          </div>
          <div className="flex items-center gap-3">
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
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="pt-20 sm:pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Find bugs before your users do
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Autonomous AI that explores your app, finds bugs, and generates Playwright test code
            — so you can ship with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors text-lg shadow-lg shadow-emerald-500/20"
            >
              Start Free Trial
              <FiArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="inline-flex items-center gap-2 px-6 py-4 text-slate-300 hover:text-white font-medium transition-colors text-lg"
            >
              See How It Works
              <FiArrowDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-24 bg-[#1E293B] px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
            How it works
          </h2>
          <p className="text-center text-slate-400 mb-14 max-w-xl mx-auto">
            Three steps. Zero test scripts to write.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: FiGlobe,
                title: 'Enter your URL',
                desc: 'Paste the URL of your web application. Public or localhost — we handle both.',
              },
              {
                step: '2',
                icon: FiSearch,
                title: 'AI explores your app',
                desc: 'Our agent navigates like a real user — clicking buttons, filling forms, testing edge cases.',
              },
              {
                step: '3',
                icon: FiFileText,
                title: 'Get a bug report with test code',
                desc: 'Receive a detailed report with screenshots, reproduction steps, and Playwright test code.',
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="absolute top-4 right-4 w-8 h-8 bg-[#0F172A] rounded-full flex items-center justify-center text-sm font-bold text-slate-500">
                  {item.step}
                </div>
                <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mb-5">
                  <item.icon className="h-6 w-6 text-sky-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
            Everything you need for autonomous QA
          </h2>
          <p className="text-center text-slate-400 mb-14 max-w-2xl mx-auto">
            Replace manual testing with an AI that never sleeps.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: FiZap,
                title: 'Autonomous QA Scanning',
                desc: 'AI navigates your app like a real user — clicking, typing, scrolling, and testing every flow it can find.',
                color: 'sky',
              },
              {
                icon: FiCamera,
                title: 'Visual Bug Evidence',
                desc: 'Every bug comes with screenshots and video recordings so you can see exactly what went wrong.',
                color: 'emerald',
              },
              {
                icon: FiCode,
                title: 'Playwright Code Export',
                desc: 'Download ready-to-run Playwright test code for every bug found. Copy, paste, and run locally.',
                color: 'violet',
              },
              {
                icon: FiClock,
                title: 'Continuous Monitoring',
                desc: 'Schedule recurring QA scans — daily, weekly, or on every deploy. Know about regressions before users do.',
                color: 'amber',
              },
            ].map((feature) => {
              const iconColors: Record<string, string> = {
                sky: 'bg-sky-500/10 text-sky-400',
                emerald: 'bg-emerald-500/10 text-emerald-400',
                violet: 'bg-violet-500/10 text-violet-400',
                amber: 'bg-amber-500/10 text-amber-400',
              };
              return (
                <div key={feature.title} className="p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-all bg-slate-800/50 hover:bg-slate-800">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${iconColors[feature.color]}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Social Proof (placeholder) ─────────────────────────────── */}
      <section className="py-16 bg-[#1E293B] px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-8">
            Trusted by engineering teams
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 rounded-xl border border-slate-700 bg-slate-800/30">
                <div className="h-4 w-24 bg-slate-700 rounded mx-auto mb-4" />
                <div className="h-3 w-full bg-slate-700/50 rounded mb-2" />
                <div className="h-3 w-3/4 bg-slate-700/50 rounded mx-auto" />
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-slate-700 rounded-full" />
                  <div>
                    <div className="h-3 w-20 bg-slate-700 rounded" />
                    <div className="h-2 w-16 bg-slate-700/50 rounded mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-slate-400 mb-14">
            Start free. Scale as you grow.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {plans.length > 0 ? plans.map((plan) => {
              const isPopular = plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('team');
              return (
                <div
                  key={plan.id}
                  className={`relative bg-slate-800 rounded-xl p-6 border ${isPopular ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-700'}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-500 text-white text-xs font-semibold rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">
                      {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
                    </span>
                    {plan.price_monthly > 0 && <span className="text-slate-400 text-sm">/mo</span>}
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    {plan.monthly_credits.toLocaleString()} credits/month
                  </p>
                  <ul className="space-y-2 mb-6">
                    {Object.entries(plan.features || {}).slice(0, 5).map(([key, val]) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-slate-300">
                        <FiCheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {typeof val === 'number' && val > 0 ? `: ${val}` : ''}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      isPopular
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Get Started
                  </button>
                </div>
              );
            }) : (
              [
                { name: 'Free Trial', price: 'Free', credits: '50', features: ['3 QA sessions/day', 'Basic bug reports', 'Community support'], popular: false },
                { name: 'Starter', price: '$29', credits: '300', features: ['Unlimited QA sessions', 'Playwright code export', 'Email support'], popular: false },
                { name: 'Pro', price: '$79', credits: '1,000', features: ['Everything in Starter', 'Auto-fix + PR', 'Scheduled monitoring', 'Priority support'], popular: true },
                { name: 'Enterprise', price: 'Custom', credits: 'Unlimited', features: ['Everything in Pro', 'SSO & RBAC', 'Dedicated support', 'Custom integrations'], popular: false },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`relative bg-slate-800 rounded-xl p-6 border ${plan.popular ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-700'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-500 text-white text-xs font-semibold rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    {plan.price !== 'Free' && plan.price !== 'Custom' && <span className="text-slate-400 text-sm">/mo</span>}
                  </div>
                  <p className="text-sm text-slate-400 mb-4">{plan.credits} credits/month</p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <FiCheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => plan.name === 'Enterprise' ? window.open('mailto:hello@whynot.dev') : navigate('/login')}
                    className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      plan.popular
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-[#1E293B]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Stop shipping bugs. Start shipping confidence.
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
            Join teams that use WhyNot to catch bugs before their users do.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors text-lg shadow-lg shadow-emerald-500/20"
          >
            Start Free Trial
            <FiArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="WhyNot" className="h-6" />
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Documentation</a>
              <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">GitHub</a>
              <a href="mailto:hello@whynot.dev" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-xs text-slate-500">
              Built by WhyNot
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
