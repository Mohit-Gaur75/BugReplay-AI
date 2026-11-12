import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import CodeBlock from '../components/CodeBlock';
import Timeline from '../components/Timeline';
import { 
  ArrowLeft, 
  Terminal, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Globe, 
  Monitor, 
  Clock, 
  AlertOctagon,
  Download
} from 'lucide-react';

export default function IncidentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCli, setCopiedCli] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchIncident = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/incidents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIncident(data.incident);
    } catch (err) {
      console.error('Failed to load incident:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id, token]);

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/v1/incidents/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setIncident((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const cliCommand = `npx bugreplay run ${id}`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
        <p className="text-sm text-slate-500 mt-3 font-mono">Loading incident telemetry...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Incident Not Found</h2>
        <p className="text-sm text-slate-400">The incident flight record you requested does not exist or has expired.</p>
        <Link to="/dashboard" className="inline-flex items-center space-x-2 text-brand-400 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Incidents</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Incidents</span>
        </Link>

        {/* Status Dropdown */}
        <div className="flex items-center space-x-3 bg-dark-900 border border-dark-800 rounded-lg p-1.5">
          <span className="text-xs text-slate-400 px-2">Status:</span>
          <select
            value={incident.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updatingStatus}
            className="bg-dark-800 text-xs font-semibold text-slate-200 rounded px-2.5 py-1 focus:outline-none cursor-pointer border border-dark-700"
          >
            <option value="OPEN">OPEN</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="IGNORED">IGNORED</option>
          </select>
        </div>
      </div>

      {/* Main Incident Title & Header */}
      <div className="p-6 rounded-2xl bg-dark-900 border border-dark-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-semibold">
            {incident.error_type || 'UncaughtError'}
          </span>
          <StatusBadge status={incident.status} />
          <span className="text-xs text-slate-500 font-mono">
            ID: {incident.id}
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
          {incident.error_message}
        </h1>

        {/* Metadata pills */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2 border-t border-dark-800/80">
          <div className="flex items-center space-x-1.5 font-mono">
            <Globe className="w-3.5 h-3.5 text-brand-400" />
            <span className="truncate max-w-sm">{incident.page_url}</span>
          </div>

          <div className="flex items-center space-x-1.5 font-mono">
            <Monitor className="w-3.5 h-3.5 text-slate-500" />
            <span>{incident.viewport || '1440x900'}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{new Date(incident.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* AI Root Cause & Diagnosis Box */}
      {incident.ai_root_cause_summary && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-dark-900 to-dark-900 border border-purple-500/30 shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-purple-400">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-wider">AI Root Cause & Suggested Fix</h2>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {incident.ai_root_cause_summary}
          </p>
        </div>
      )}

      {/* CLI 1-Click Reproduction Box */}
      <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center text-brand-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Run Locally with 1 Command</div>
            <div className="text-xs text-slate-500">Playwright boots locally, replicates clicks, mocks API responses, and passes in 5s.</div>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <code className="px-3 py-1.5 bg-black/60 text-brand-300 font-mono text-xs rounded border border-dark-700 select-all flex-1 sm:flex-initial">
            {cliCommand}
          </code>
          <button
            onClick={handleCopyCli}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
          >
            {copiedCli ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCli ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side: Timeline vs Synthesized Playwright Test */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Visual Timeline (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>Flight Recorder Timeline</span>
              <span className="text-xs px-2 py-0.5 rounded bg-dark-800 text-slate-400 font-mono">
                Last {incident.telemetry?.length || 0} Events
              </span>
            </h2>
          </div>

          <Timeline telemetry={incident.telemetry} />
        </div>

        {/* Right Column: Playwright Script (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>Synthesized Playwright Test</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Clean .spec.js
              </span>
            </h2>
          </div>

          <CodeBlock
            code={incident.generated_playwright_test || '// Playwright test synthesis in progress...'}
            filename={`bug-replay-${incident.id}.spec.js`}
            downloadUrl={`/api/v1/incidents/${incident.id}/test-file`}
          />

          {/* Stack trace accordion/preview */}
          {incident.error_stack && (
            <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Captured Error Stack Trace
              </span>
              <pre className="text-xs font-mono text-rose-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {incident.error_stack}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
