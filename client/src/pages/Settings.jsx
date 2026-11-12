import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Key, 
  Copy, 
  Check, 
  Code2, 
  CreditCard, 
  ShieldAlert, 
  Zap, 
  CheckCircle2, 
  Layers,
  Sparkles
} from 'lucide-react';

export default function Settings() {
  const { user, activeProject, updatePlan } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const apiKey = activeProject?.api_key || 'br_live_demo_1234567890abcdef';

  const embedSnippet = `<!-- BugReplay AI In-Browser Flight Recorder SDK (3KB) -->
<script 
  src="${window.location.origin}/bugreplay.js" 
  data-api-key="${apiKey}" 
  data-endpoint="${window.location.origin}/api/v1/ingest" 
  defer>
</script>`;

  const reactSnippet = `// In your React App.jsx or Next.js layout.tsx
import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${window.location.origin}/bugreplay.js';
    script.setAttribute('data-api-key', '${apiKey}');
    script.setAttribute('data-endpoint', '${window.location.origin}/api/v1/ingest');
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return <>{children}</>;
}`;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handlePlanUpgrade = async (tier) => {
    setUpgrading(true);
    setSuccessMessage('');
    try {
      await updatePlan(tier);
      setSuccessMessage(`Plan successfully switched to ${tier}!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const currentTier = user?.plan_tier || 'FREE';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="border-b border-dark-800 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Project Settings & SDK</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage API keys, client embedding scripts, and subscription quotas.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center space-x-2 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* API Key Card */}
      <div className="p-6 rounded-2xl bg-dark-900 border border-dark-800 shadow-xl space-y-4">
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-brand-400" />
          <h2 className="text-base font-bold text-white">Project API Key</h2>
        </div>
        <p className="text-xs text-slate-400">
          This key authenticates incoming crash packets from your application SDK to BugReplay.
        </p>

        <div className="flex items-center space-x-3 max-w-2xl">
          <input
            type="text"
            readOnly
            value={apiKey}
            className="flex-1 px-4 py-2 bg-dark-950 border border-dark-800 rounded-lg text-xs font-mono text-brand-300 focus:outline-none select-all"
          />
          <button
            onClick={handleCopyKey}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-200 text-xs font-medium border border-dark-700 transition-colors"
          >
            {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
          </button>
        </div>
      </div>

      {/* Embed Code Snippet Card */}
      <div className="p-6 rounded-2xl bg-dark-900 border border-dark-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Embed Script (HTML / Next.js)</h2>
          </div>
          <button
            onClick={handleCopySnippet}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSnippet ? 'Snippet Copied' : 'Copy HTML Snippet'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Paste this snippet inside the <code className="text-brand-300">&lt;head&gt;</code> of your application. The 3KB script records the last 15 user actions with zero performance lag and masks all sensitive inputs.
        </p>

        <pre className="p-4 rounded-xl bg-dark-950 font-mono text-xs text-slate-300 overflow-x-auto border border-dark-800/80 leading-relaxed">
          {embedSnippet}
        </pre>
      </div>

      {/* Subscription Pricing Tiers */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-400" />
            <span>Subscription & Monthly Bug Quota</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose the plan that fits your engineering team's scale. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* FREE TIER */}
          <div className={`p-6 rounded-2xl bg-dark-900 border ${currentTier === 'FREE' ? 'border-brand-500 ring-1 ring-brand-500' : 'border-dark-800'} shadow-xl flex flex-col justify-between space-y-6`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hobby</span>
                {currentTier === 'FREE' && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    Active Plan
                  </span>
                )}
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white">$0</span>
                <span className="text-xs text-slate-400 font-medium"> / month</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2.5">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>50 bugs/mo</strong> flight recording</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>1 Active Project</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Playwright Test Synthesis</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>7-Day Retention</span>
                </li>
              </ul>
            </div>

            <button
              disabled={currentTier === 'FREE' || upgrading}
              onClick={() => handlePlanUpgrade('FREE')}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                currentTier === 'FREE'
                  ? 'bg-dark-800 text-slate-500 cursor-default'
                  : 'bg-dark-800 hover:bg-dark-700 text-slate-200'
              }`}
            >
              {currentTier === 'FREE' ? 'Current Plan' : 'Downgrade to Free'}
            </button>
          </div>

          {/* PRO TIER */}
          <div className={`p-6 rounded-2xl bg-gradient-to-b from-dark-850 to-dark-900 border ${currentTier === 'PRO' ? 'border-brand-500 ring-2 ring-brand-500' : 'border-brand-500/40'} shadow-2xl flex flex-col justify-between space-y-6 relative`}>
            <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
              Most Popular
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Pro Developer</span>
                {currentTier === 'PRO' && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    Active Plan
                  </span>
                )}
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white">$29</span>
                <span className="text-xs text-slate-400 font-medium"> / month</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2.5">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span><strong>1,000 bugs/mo</strong> flight recording</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>5 Active Projects</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span><strong>Gemini 2.0 Flash</strong> AI Root Cause & Fixes</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>30-Day Retention</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>Priority Telemetry Ingestion</span>
                </li>
              </ul>
            </div>

            <button
              disabled={currentTier === 'PRO' || upgrading}
              onClick={() => handlePlanUpgrade('PRO')}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                currentTier === 'PRO'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30 cursor-default'
                  : 'bg-brand-600 hover:bg-brand-500 text-white hover:scale-[1.02]'
              }`}
            >
              {currentTier === 'PRO' ? 'Current Plan' : 'Upgrade to Pro ($29/mo)'}
            </button>
          </div>

          {/* TEAM TIER */}
          <div className={`p-6 rounded-2xl bg-dark-900 border ${currentTier === 'TEAM' ? 'border-brand-500 ring-1 ring-brand-500' : 'border-dark-800'} shadow-xl flex flex-col justify-between space-y-6`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Team / Scale</span>
                {currentTier === 'TEAM' && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    Active Plan
                  </span>
                )}
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white">$79</span>
                <span className="text-xs text-slate-400 font-medium"> / month</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2.5">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>5,000 bugs/mo</strong> flight recording</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Unlimited Projects</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>90-Day Retention</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Slack & Discord Alert Webhooks</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>5 Team Seats</span>
                </li>
              </ul>
            </div>

            <button
              disabled={currentTier === 'TEAM' || upgrading}
              onClick={() => handlePlanUpgrade('TEAM')}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                currentTier === 'TEAM'
                  ? 'bg-dark-800 text-slate-500 cursor-default'
                  : 'bg-dark-800 hover:bg-dark-700 text-slate-200'
              }`}
            >
              {currentTier === 'TEAM' ? 'Current Plan' : 'Upgrade to Team ($79/mo)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
