import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import CodeBlock from '../components/common/CodeBlock.jsx';
import VisualTimeline from '../components/incidents/VisualTimeline.jsx';
import { 
  ArrowLeft, 
  Bug, 
  Globe, 
  Monitor, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Code2,
  Terminal,
  Clock
} from 'lucide-react';

export default function IncidentDetails({ incidentId, onBack }) {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchIncident = async () => {
    try {
      const res = await api.get(`/incidents/${incidentId}`);
      setIncident(res.data?.incident);
    } catch (err) {
      setError(err.message || 'Failed to load incident details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [incidentId]);

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/incidents/${incidentId}/status`, { status: newStatus });
      setIncident(res.data?.incident);
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await api.post(`/incidents/${incidentId}/regenerate`);
      setTimeout(() => {
        fetchIncident();
        setRegenerating(false);
      }, 2000);
    } catch (err) {
      alert(`Could not regenerate test: ${err.message}`);
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-zinc-500">
        Loading incident flight recorder telemetry...
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="text-red-400 text-sm mb-4">{error || 'Incident not found'}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-surface border border-border text-xs rounded-lg text-white"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-surface border border-border text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-zinc-500">#{incident.id.slice(0, 8)}</span>
              <span className="text-zinc-500">•</span>
              <span className="font-mono text-xs text-blue-400">{incident.project_name}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-xs text-zinc-400 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>{new Date(incident.created_at).toLocaleString()}</span>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-1">
              {incident.error_message}
            </h1>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center space-x-3">
          <label className="text-xs text-zinc-400">Status:</label>
          <select
            value={incident.status}
            disabled={updatingStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
          >
            <option value="OPEN">OPEN</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="IGNORED">IGNORED</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Debugging Timeline vs AI Diagnosis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Flight Telemetry & Timeline (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Metadata Card */}
          <div className="p-4 bg-surface border border-border rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-zinc-500 block text-[11px] mb-0.5">Culprit URL</span>
              <span className="font-mono text-zinc-200 truncate block" title={incident.page_url}>
                {incident.page_url}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[11px] mb-0.5">Viewport</span>
              <span className="font-mono text-zinc-200 block">
                {incident.viewport || '1440x900'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[11px] mb-0.5">Error Type</span>
              <span className="font-mono text-red-400 font-semibold block">
                {incident.error_type || 'Error'}
              </span>
            </div>
          </div>

          {/* Stack Trace */}
          {incident.error_stack && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400 mb-2">
                <Code2 className="w-3.5 h-3.5 text-red-400" />
                <span>Captured JavaScript Stack Trace</span>
              </div>
              <pre className="p-3 bg-background rounded-lg border border-border font-mono text-[11px] text-red-300 leading-relaxed overflow-x-auto m-0 max-h-48">
                {incident.error_stack}
              </pre>
            </div>
          )}

          {/* Chronological Breadcrumb Timeline */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center space-x-2">
              <span>Chronological Action Timeline (Pre-Crash)</span>
            </h2>
            <VisualTimeline 
              telemetry={incident.telemetry} 
              errorDetails={{ errorMessage: incident.error_message, errorType: incident.error_type }}
            />
          </div>
        </div>

        {/* Right Column: AI Root Cause & Fix Suggestion (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Root Cause Card */}
          <div className="bg-gradient-to-b from-purple-950/20 to-surface border border-purple-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">AI Root Cause Diagnosis</h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                incident.confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {incident.confidence || 'AI ANALYZED'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-purple-300 font-semibold block mb-1">What Broke:</span>
                <p className="text-zinc-200 leading-relaxed">
                  {incident.ai_root_cause_summary || 'Analyzing incident telemetry to isolate failure root cause...'}
                </p>
              </div>

              {incident.suggested_fix && (
                <div className="p-3 bg-background/80 border border-border rounded-lg">
                  <span className="text-emerald-400 font-semibold block mb-1 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Recommended Code Fix:</span>
                  </span>
                  <p className="text-zinc-300 font-mono text-[11px] leading-relaxed">
                    {incident.suggested_fix}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-purple-500/20 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">
                Status: {incident.generation_status}
              </span>
              <button
                disabled={regenerating}
                onClick={handleRegenerate}
                className="flex items-center space-x-1.5 text-xs text-purple-300 hover:text-white px-2.5 py-1 rounded bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{regenerating ? 'Re-synthesizing...' : 'Re-run AI Analysis'}</span>
              </button>
            </div>
          </div>

          {/* Quick Local Repro Card */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h4 className="text-xs font-semibold text-white mb-2 flex items-center space-x-1.5">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>5-Second Local Reproduction</span>
            </h4>
            <p className="text-xs text-zinc-400 mb-3">
              Run this command in your terminal to boot up Playwright, mock the failing API response, and watch the bug replay headfully:
            </p>
            <div className="p-2.5 bg-background border border-border rounded-lg font-mono text-xs text-blue-300 select-all overflow-x-auto">
              npx bugreplay run {incident.id} --headed
            </div>
          </div>
        </div>
      </div>

      {/* Synthesized Playwright Test Section (Full Width) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Synthesized Playwright End-to-End Test (.spec.js)
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Mocks failed routes & replicates exact click sequence
          </span>
        </div>

        <CodeBlock 
          code={incident.generated_playwright_test || '// Synthesizing Playwright test... Refresh in a few seconds.'}
          filename={`bug-replay-${incident.id.slice(0, 8)}.spec.js`}
          incidentId={incident.id}
        />
      </div>
    </div>
  );
}
