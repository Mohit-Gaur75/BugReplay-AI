import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CreditCard, CheckCircle2, Zap, Shield, Sparkles } from 'lucide-react';

export default function Billing() {
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const fetchUsage = async () => {
    try {
      const res = await api.get('/billing/usage');
      setUsage(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const handleSimulateUpgrade = async (tier) => {
    setUpgrading(true);
    try {
      await api.post('/billing/simulate-upgrade', { plan_tier: tier });
      window.location.reload(); // Refresh session
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
      setUpgrading(false);
    }
  };

  const percentageUsed = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Subscription Plans & Quota</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Review your incident volume usage, billing tier entitlements, and dev simulation switch.
        </p>
      </div>

      {/* Usage Meter Card */}
      {usage && (
        <div className="p-6 bg-surface border border-border rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs text-zinc-400 block mb-1">Current Billing Period ({usage.billing_period})</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold font-mono text-white">{usage.used}</span>
                <span className="text-xs text-zinc-500 font-mono">/ {usage.limit} incidents used</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-400 block mb-1">Current Tier</span>
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {usage.plan_tier} PLAN
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border">
            <div
              className={`h-full transition-all duration-500 ${
                percentageUsed > 80 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${percentageUsed}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-zinc-500 mt-2">
            <span>{percentageUsed}% of quota consumed</span>
            <span>{usage.remaining} incidents remaining</span>
          </div>
        </div>
      )}

      {/* Plan Tiers Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* FREE */}
        <div className={`p-6 rounded-xl border flex flex-col justify-between ${
          user?.plan_tier === 'FREE' ? 'bg-surface-elevated/40 border-blue-500/50' : 'bg-surface border-border'
        }`}>
          <div>
            <h3 className="text-base font-bold text-white">Free</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Indie hackers & hobbyists</p>
            <div className="mt-4 text-2xl font-extrabold text-white font-mono">$0 <span className="text-xs text-zinc-500 font-normal">/ mo</span></div>

            <ul className="mt-6 space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>50 incidents / mo</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>1 active project</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>7-day telemetry retention</span></li>
            </ul>
          </div>

          <button
            disabled={user?.plan_tier === 'FREE' || upgrading}
            onClick={() => handleSimulateUpgrade('FREE')}
            className="mt-6 w-full py-2 rounded-lg bg-surface-elevated border border-border hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
          >
            {user?.plan_tier === 'FREE' ? 'Current Plan' : 'Switch to Free'}
          </button>
        </div>

        {/* PRO */}
        <div className={`p-6 rounded-xl border flex flex-col justify-between relative ${
          user?.plan_tier === 'PRO' ? 'bg-surface-elevated/40 border-blue-500' : 'bg-surface border-border'
        }`}>
          <div>
            <h3 className="text-base font-bold text-white">Pro</h3>
            <p className="text-xs text-zinc-400 mt-0.5">SaaS founders & production apps</p>
            <div className="mt-4 text-2xl font-extrabold text-white font-mono">$29 <span className="text-xs text-zinc-500 font-normal">/ mo</span></div>

            <ul className="mt-6 space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>1,000 incidents / mo</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>5 active projects</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>Gemini AI Root Cause</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>30-day retention</span></li>
            </ul>
          </div>

          <button
            disabled={user?.plan_tier === 'PRO' || upgrading}
            onClick={() => handleSimulateUpgrade('PRO')}
            className="mt-6 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow"
          >
            {user?.plan_tier === 'PRO' ? 'Current Plan' : 'Simulate Upgrade to Pro'}
          </button>
        </div>

        {/* TEAM */}
        <div className={`p-6 rounded-xl border flex flex-col justify-between ${
          user?.plan_tier === 'TEAM' ? 'bg-surface-elevated/40 border-blue-500/50' : 'bg-surface border-border'
        }`}>
          <div>
            <h3 className="text-base font-bold text-white">Team</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Engineering teams & agencies</p>
            <div className="mt-4 text-2xl font-extrabold text-white font-mono">$79 <span className="text-xs text-zinc-500 font-normal">/ mo</span></div>

            <ul className="mt-6 space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>5,000 incidents / mo</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Unlimited projects</span></li>
              <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>90-day retention</span></li>
            </ul>
          </div>

          <button
            disabled={user?.plan_tier === 'TEAM' || upgrading}
            onClick={() => handleSimulateUpgrade('TEAM')}
            className="mt-6 w-full py-2 rounded-lg bg-surface-elevated border border-border hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
          >
            {user?.plan_tier === 'TEAM' ? 'Current Plan' : 'Simulate Upgrade to Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
