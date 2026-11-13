import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Terminal, Cpu } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/health')
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setHealth({ status: 'error', error: err.message });
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col justify-center items-center p-6">
      <div className="max-w-xl w-full bg-surface border border-border rounded-xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">BugReplay AI</h1>
            <p className="text-xs text-zinc-400">Production Bug Replay & Playwright Test Generator</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">Backend Health Check</span>
            </div>
            <div>
              {loading ? (
                <span className="text-xs text-zinc-500">Checking...</span>
              ) : health?.status === 'healthy' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  HEALTHY
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                  OFFLINE
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface-elevated border border-border-subtle">
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400 mb-2">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Diagnostic Payload</span>
            </div>
            <pre className="text-xs font-mono bg-background p-3 rounded border border-border text-zinc-300 overflow-x-auto">
              {JSON.stringify(health || { status: 'loading' }, null, 2)}
            </pre>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Phase 1: Project Foundation Ready</span>
          </div>
          <span>ES Modules + SQLite WAL</span>
        </div>
      </div>
    </div>
  );
}
