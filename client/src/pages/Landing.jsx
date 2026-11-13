import React from 'react';
import { Bug, ArrowRight, Play, CheckCircle2, Shield, Terminal, Zap, Code2, Cpu } from 'lucide-react';

export default function Landing({ onStartFree, onTryDemo, onLogin }) {
  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col selection:bg-blue-500/30">
      {/* Top Navigation */}
      <header className="border-b border-border/80 bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bug className="w-4 h-4 text-blue-400" />
            </div>
            <span className="font-bold text-base text-white tracking-tight">BugReplay AI</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={onTryDemo}
              className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Interactive Demo
            </button>
            <button
              onClick={onLogin}
              className="text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onStartFree}
              className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              Start for Free
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          <span>Next-Generation Automated Bug Reproduction</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Stop guessing.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
            Reproduce every production bug.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          BugReplay turns real user interactions and production errors into reproducible Playwright tests — automatically.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartFree}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 transition-all"
          >
            <span>Start for Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onTryDemo}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface border border-border hover:bg-surface-elevated text-zinc-200 font-medium text-sm flex items-center justify-center space-x-2 transition-all"
          >
            <Play className="w-4 h-4 text-blue-400" />
            <span>Try Live Demo Sandbox</span>
          </button>
        </div>

        {/* Value Metrics */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-left border-t border-border/60 pt-10">
          <div className="p-4 bg-surface/50 border border-border rounded-lg">
            <div className="text-2xl font-bold font-mono text-white">5 Sec</div>
            <div className="text-xs text-zinc-400 mt-1">Local reproduction time</div>
          </div>
          <div className="p-4 bg-surface/50 border border-border rounded-lg">
            <div className="text-2xl font-bold font-mono text-emerald-400">&lt; 3 KB</div>
            <div className="text-xs text-zinc-400 mt-1">Zero-dependency capture SDK</div>
          </div>
          <div className="p-4 bg-surface/50 border border-border rounded-lg">
            <div className="text-2xl font-bold font-mono text-blue-400">100%</div>
            <div className="text-xs text-zinc-400 mt-1">Playwright route mock fidelity</div>
          </div>
          <div className="p-4 bg-surface/50 border border-border rounded-lg">
            <div className="text-2xl font-bold font-mono text-purple-400">Zero</div>
            <div className="text-xs text-zinc-400 mt-1">Password or card PII leaks</div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-16 bg-surface/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              The 4-Hour "Cannot Reproduce" Nightmare
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              When a user reports that checkout broke, developers spend hours playing detective.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <Bug className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Vague User Bug Reports</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                "The button didn't work." No browser version, no viewport dimensions, no clue which input triggered the crash.
              </p>
            </div>

            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Silent API Failures</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A background 500 error or timeout caused client state corruption, but standard error monitors only report the resulting TypeError.
              </p>
            </div>

            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Hours Writing E2E Tests</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Even when isolated, developers spend hours manually writing a Playwright reproduction spec with mock network endpoints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            How BugReplay AI Works
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            A complete flight recorder that converts user actions into code.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="relative p-6 bg-surface border border-border rounded-xl">
            <div className="text-xs font-mono font-bold text-blue-400 mb-2">STEP 01</div>
            <h3 className="text-base font-semibold text-white mb-2">Embed 3KB SDK</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Add one script tag to your web app. An in-memory circular buffer keeps the last 15 user clicks, network calls, and console logs.
            </p>
          </div>

          <div className="relative p-6 bg-surface border border-border rounded-xl">
            <div className="text-xs font-mono font-bold text-blue-400 mb-2">STEP 02</div>
            <h3 className="text-base font-semibold text-white mb-2">Automated PII Masking</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Passwords, credit cards, CVVs, and sensitive headers are scrubbed locally in memory before telemetry is transmitted.
            </p>
          </div>

          <div className="relative p-6 bg-surface border border-border rounded-xl">
            <div className="text-xs font-mono font-bold text-blue-400 mb-2">STEP 03</div>
            <h3 className="text-base font-semibold text-white mb-2">AI Playwright Synthesis</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When a crash occurs, BugReplay synthesizes an executable Playwright test mocking failed endpoints and replaying user clicks.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-surface/30 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Predictable, Transparent Pricing
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Start free. Upgrade as your team and volume grow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Tier */}
            <div className="p-8 bg-surface border border-border rounded-xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Free</h3>
                <p className="text-xs text-zinc-400 mt-1">For indie devs and side projects</p>
                <div className="mt-6 text-3xl font-extrabold text-white">$0 <span className="text-xs text-zinc-500 font-normal">/ month</span></div>

                <ul className="mt-6 space-y-3 text-xs text-zinc-300">
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>50 captured bugs / month</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>1 active project</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Playwright test generation</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>7-day telemetry retention</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>CLI local reproduction</span></li>
                </ul>
              </div>

              <button
                onClick={onStartFree}
                className="mt-8 w-full py-2.5 rounded-lg border border-border bg-surface-elevated hover:bg-zinc-800 text-xs font-semibold text-white transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Pro Tier */}
            <div className="relative p-8 bg-surface border-2 border-blue-500/50 rounded-xl flex flex-col justify-between shadow-xl shadow-blue-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Pro</h3>
                <p className="text-xs text-zinc-400 mt-1">For fast-moving SaaS startups</p>
                <div className="mt-6 text-3xl font-extrabold text-white">$29 <span className="text-xs text-zinc-500 font-normal">/ month</span></div>

                <ul className="mt-6 space-y-3 text-xs text-zinc-300">
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>1,000 captured bugs / month</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>5 active projects</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>Gemini 2.0 Flash AI Root Cause</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>Recommended code fix diffs</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /><span>30-day telemetry retention</span></li>
                </ul>
              </div>

              <button
                onClick={onStartFree}
                className="mt-8 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>

            {/* Team Tier */}
            <div className="p-8 bg-surface border border-border rounded-xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Team</h3>
                <p className="text-xs text-zinc-400 mt-1">For growing engineering teams</p>
                <div className="mt-6 text-3xl font-extrabold text-white">$79 <span className="text-xs text-zinc-500 font-normal">/ month</span></div>

                <ul className="mt-6 space-y-3 text-xs text-zinc-300">
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>5,000 captured bugs / month</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Unlimited projects</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>90-day telemetry retention</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Priority queue synthesis</span></li>
                  <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Team seats & shared workspace</span></li>
                </ul>
              </div>

              <button
                onClick={onStartFree}
                className="mt-8 w-full py-2.5 rounded-lg border border-border bg-surface-elevated hover:bg-zinc-800 text-xs font-semibold text-white transition-colors"
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Bug className="w-4 h-4 text-blue-400" />
            <span className="text-zinc-400 font-medium">BugReplay AI</span>
            <span>— The developer bug flight recorder.</span>
          </div>
          <div>© {new Date().getFullYear()} BugReplay AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
