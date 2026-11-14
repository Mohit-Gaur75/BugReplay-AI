import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import CodeBlock from '../components/common/CodeBlock.jsx';
import VisualTimeline from '../components/incidents/VisualTimeline.jsx';
import { generateGitPatch } from '../utils/frameworkConverter.js';
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
  Clock,
  Share2,
  FileText,
  ExternalLink,
  Copy,
  Check,
  X,
  GitBranch,
  Download,
  Play,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';

export default function IncidentDetails({ incidentId, onBack }) {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);

  // Cloud Test Runner State
  const [runningTest, setRunningTest] = useState(false);
  const [testRuns, setTestRuns] = useState([]);
  const [showLogs, setShowLogs] = useState(true);
  const [showRunsHistory, setShowRunsHistory] = useState(false);
  const [testError, setTestError] = useState(null);

  // GitHub Issue Modal State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [copiedIssue, setCopiedIssue] = useState(false);

  // Git Patch Modal State
  const [showPatchModal, setShowPatchModal] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);

  // GitHub Pull Request Modal State
  const [showPrModal, setShowPrModal] = useState(false);
  const [prRepo, setPrRepo] = useState('');
  const [prToken, setPrToken] = useState('');
  const [prBaseBranch, setPrBaseBranch] = useState('main');
  const [creatingPr, setCreatingPr] = useState(false);
  const [prResult, setPrResult] = useState(null);
  const [prError, setPrError] = useState(null);

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

  const fetchTestRuns = async () => {
    try {
      const res = await api.get(`/incidents/${incidentId}/test-runs`);
      setTestRuns(res.data?.testRuns || []);
    } catch (e) {
      // Non-blocking
    }
  };

  const handleRunCloudTest = async () => {
    setRunningTest(true);
    setTestError(null);
    setIncident((prev) => ({ ...prev, test_status: 'RUNNING' }));
    setShowLogs(true);

    try {
      const res = await api.post(`/incidents/${incidentId}/run-test`, {});
      const result = res.data;
      setIncident((prev) => ({
        ...prev,
        test_status: result.status,
        test_duration_ms: result.durationMs,
        test_logs: result.logs,
        test_last_run_at: new Date().toISOString(),
      }));
      fetchTestRuns();
    } catch (err) {
      setTestError(err.message || 'Failed to execute test in cloud runner');
      setIncident((prev) => ({ ...prev, test_status: 'ERROR' }));
    } finally {
      setRunningTest(false);
    }
  };

  useEffect(() => {
    fetchIncident();
    fetchTestRuns();
  }, [incidentId]);

  // Real-Time SSE Stream Integration for Test Execution
  useEffect(() => {
    const token = localStorage.getItem('bugreplay_token');
    if (!token) return;

    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/v1/incidents/stream?token=${encodeURIComponent(token)}`);

      eventSource.addEventListener('test_run.completed', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.incidentId === incidentId) {
            fetchIncident();
            fetchTestRuns();
          }
        } catch {}
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
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

  const handleCreatePr = async (e) => {
    e.preventDefault();
    setCreatingPr(true);
    setPrError(null);
    try {
      const res = await api.post(`/incidents/${incidentId}/create-pr`, {
        repo: prRepo,
        token: prToken || undefined,
        baseBranch: prBaseBranch || 'main',
      });
      setPrResult(res.data);
    } catch (err) {
      setPrError(err.message || 'Failed to create GitHub Pull Request');
    } finally {
      setCreatingPr(false);
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
              {(incident.occurrence_count || 1) > 1 && (
                <>
                  <span className="text-zinc-500">•</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    🔥 {incident.occurrence_count} Occurrences
                  </span>
                </>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-1">
              {incident.error_message}
            </h1>
          </div>
        </div>

        {/* Action Controls & Status Dropdown */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setPrRepo(incident.github_repo || '');
              setPrResult(null);
              setPrError(null);
              setShowPrModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Create GitHub PR</span>
          </button>

          <button
            onClick={() => setShowGithubModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-elevated text-zinc-300 hover:text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Export to GitHub</span>
          </button>

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
                <div className="p-3 bg-background/80 border border-border rounded-lg space-y-2">
                  <div>
                    <span className="text-emerald-400 font-semibold block mb-1 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Recommended Code Fix:</span>
                    </span>
                    <p className="text-zinc-300 font-mono text-[11px] leading-relaxed">
                      {incident.suggested_fix}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPatchModal(true)}
                    className="flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>View Unified Git Patch (.patch)</span>
                  </button>
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

      {/* Cloud Playwright Verification & Test Runner Console */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-sm font-bold text-white">Playwright Cloud Verification Engine</h3>
                {incident.test_status === 'REPRODUCED' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>✓ REPRODUCED BUG</span>
                  </span>
                )}
                {incident.test_status === 'PASSED' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>✓ ALL ASSERTIONS PASSED</span>
                  </span>
                )}
                {incident.test_status === 'RUNNING' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>EXECUTING IN CHROMIUM...</span>
                  </span>
                )}
                {incident.test_status === 'ERROR' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>RUNNER ERROR</span>
                  </span>
                )}
                {(!incident.test_status || incident.test_status === 'UNTESTED') && (
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-medium text-zinc-400 bg-zinc-800 border border-zinc-700">
                    UNTESTED
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Executes the generated Playwright test script inside an isolated headless Chromium environment to verify reproducibility
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {testRuns.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRunsHistory(!showRunsHistory)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-border transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>{testRuns.length} Runs</span>
                {showRunsHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleRunCloudTest}
              disabled={runningTest || !incident.generated_playwright_test}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {runningTest ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing in Cloud...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Test in Cloud</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* History Accordion */}
        {showRunsHistory && testRuns.length > 0 && (
          <div className="p-3 bg-background border border-border rounded-lg space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold block">Execution History</span>
            <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
              {testRuns.map((run, idx) => (
                <div key={run.id} className="py-2 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-500">#{testRuns.length - idx}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      run.status === 'REPRODUCED' ? 'text-emerald-400 bg-emerald-500/10' :
                      run.status === 'PASSED' ? 'text-blue-400 bg-blue-500/10' :
                      run.status === 'RUNNING' ? 'text-amber-400 bg-amber-500/10' :
                      'text-red-400 bg-red-500/10'
                    }`}>
                      {run.status}
                    </span>
                    <span className="text-zinc-400">{run.duration_ms}ms</span>
                  </div>
                  <span className="text-zinc-500 text-[11px]">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terminal Execution Output Console */}
        {(incident.test_logs || incident.test_status === 'RUNNING' || testError) && (
          <div className="border border-border rounded-lg overflow-hidden bg-[#090d16]">
            <div className="px-3.5 py-2 bg-surface-elevated/70 border-b border-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-[11px] font-mono text-zinc-400 pl-2">
                  Headless Playwright Execution Console (incident-{incident.id.slice(0, 8)}.spec.js)
                </span>
              </div>
              <div className="flex items-center space-x-3 text-[11px] font-mono text-zinc-400">
                {incident.test_duration_ms && (
                  <span>Duration: <strong className="text-zinc-200">{incident.test_duration_ms}ms</strong></span>
                )}
                {incident.test_last_run_at && (
                  <span>Executed: <strong className="text-zinc-200">{new Date(incident.test_last_run_at).toLocaleTimeString()}</strong></span>
                )}
                <button
                  type="button"
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {showLogs && (
              <pre className="p-4 font-mono text-xs text-zinc-300 leading-relaxed overflow-x-auto max-h-72 m-0 select-text whitespace-pre-wrap">
                {runningTest ? (
                  <span className="text-amber-400 animate-pulse">
                    [BugReplay Cloud Runner] Spawning headless Chromium worker...{"\n"}
                    [BugReplay Cloud Runner] Navigating to {incident.page_url}...{"\n"}
                    [BugReplay Cloud Runner] Applying route mocks and executing user click sequence...
                  </span>
                ) : testError ? (
                  <span className="text-red-400">{testError}</span>
                ) : (
                  incident.test_logs || '[BugReplay Cloud Runner] Ready to execute reproduction test.'
                )}
              </pre>
            )}
          </div>
        )}
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
          incident={incident}
        />
      </div>

      {/* Modal: Export to GitHub Issue */}
      {showGithubModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-zinc-800 text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Export to GitHub Issue</h3>
                  <p className="text-[11px] text-zinc-400">Pre-formatted issue report with stack trace, AI diagnosis, and reproduction test</p>
                </div>
              </div>

              <button
                onClick={() => setShowGithubModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Markdown Issue Body Preview</label>
              <textarea
                readOnly
                rows={12}
                value={`## 🐛 Bug Report (Captured by BugReplay AI #${incident.id.slice(0, 8)})

**Error:** \`${incident.error_type || 'Error'}: ${incident.error_message}\`  
**Page URL:** ${incident.page_url}  
**Viewport:** ${incident.viewport || '1440x900'}  
**Timestamp:** ${new Date(incident.created_at).toUTCString()}  

---

### 🔍 AI Root Cause Diagnosis
${incident.ai_root_cause_summary || 'Analyzing telemetry to isolate failure root cause.'}

${incident.suggested_fix ? `### 💡 Recommended Fix\n\`\`\`javascript\n${incident.suggested_fix}\n\`\`\`\n` : ''}
---

### 🧪 Automated Playwright Reproduction Test
\`\`\`javascript
${incident.generated_playwright_test || '// Synthesizing...'}
\`\`\`

---

### 🚀 1-Click Local CLI Reproduction
\`\`\`bash
npx bugreplay run ${incident.id} --headed
\`\`\`
*Generated automatically by [BugReplay AI](https://bugreplay.dev).*`}
                className="w-full p-3 bg-background border border-border rounded-lg font-mono text-[11px] text-zinc-300 focus:outline-none select-all"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-[11px] text-zinc-500">
                Paste directly into any GitHub or GitLab issue tracker.
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `## 🐛 Bug Report (Captured by BugReplay AI #${incident.id.slice(0, 8)})\n\n**Error:** \`${incident.error_type || 'Error'}: ${incident.error_message}\`\n**Page URL:** ${incident.page_url}\n**Viewport:** ${incident.viewport || '1440x900'}\n**Timestamp:** ${new Date(incident.created_at).toUTCString()}\n\n---\n\n### 🔍 AI Root Cause Diagnosis\n${incident.ai_root_cause_summary || 'Analyzing telemetry to isolate failure root cause.'}\n\n${incident.suggested_fix ? `### 💡 Recommended Fix\n\`\`\`javascript\n${incident.suggested_fix}\n\`\`\`\n` : ''}\n---\n\n### 🧪 Automated Playwright Reproduction Test\n\`\`\`javascript\n${incident.generated_playwright_test || '// Synthesizing...'}\n\`\`\`\n\n---\n\n### 🚀 1-Click Local CLI Reproduction\n\`\`\`bash\nnpx bugreplay run ${incident.id} --headed\n\`\`\`\n*Generated automatically by BugReplay AI.*`;
                    navigator.clipboard.writeText(text);
                    setCopiedIssue(true);
                    setTimeout(() => setCopiedIssue(false), 2000);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
                >
                  {copiedIssue ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIssue ? 'Copied Markdown!' : 'Copy Markdown'}</span>
                </button>

                <a
                  href={`https://github.com/issues`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>Open GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Unified Git Patch */}
      {showPatchModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Automated Git Patch (Unified Diff)</h3>
                  <p className="text-[11px] text-zinc-400">Apply this patch to your repository using git apply</p>
                </div>
              </div>

              <button
                onClick={() => setShowPatchModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto">
              <div className="mb-2 p-2 bg-background border border-border rounded flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Terminal command:</span>
                  <span className="text-zinc-200 select-all">git apply fix.patch</span>
                </span>
              </div>

              <pre className="p-3 bg-background border border-border rounded-lg font-mono text-[11px] text-emerald-300 leading-relaxed overflow-x-auto select-all m-0 max-h-80">
                {generateGitPatch(incident)}
              </pre>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generateGitPatch(incident));
                  setCopiedPatch(true);
                  setTimeout(() => setCopiedPatch(false), 2000);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
              >
                {copiedPatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPatch ? 'Copied Patch!' : 'Copy Patch'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const patchContent = generateGitPatch(incident);
                  const blob = new Blob([patchContent], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `bugreplay-fix-${incident.id.slice(0, 8)}.patch`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .patch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Automated GitHub Pull Request Generator */}
      {showPrModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-lg w-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create GitHub Pull Request</h3>
                  <p className="text-[11px] text-zinc-400">Pushes reproduction test suite and opens PR automatically</p>
                </div>
              </div>

              <button
                onClick={() => setShowPrModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prResult ? (
              <div className="my-6 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Pull Request #{prResult.pullRequestNumber} Created!</h4>
                  <p className="text-xs text-zinc-400 mt-1">Branch <span className="font-mono text-emerald-400">{prResult.branch}</span> pushed to GitHub.</p>
                </div>
                <div className="p-3 bg-background border border-border rounded-lg text-xs font-mono text-zinc-300 break-all">
                  {prResult.pullRequestUrl}
                </div>
                <div className="flex items-center justify-center space-x-3 pt-2">
                  <a
                    href={prResult.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <span>View Pull Request on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setShowPrModal(false)}
                    className="px-4 py-2 rounded-lg bg-surface border border-border text-zinc-300 hover:text-white text-xs font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePr} className="my-4 space-y-4">
                {prError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                    {prError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">GitHub Repository (owner/repo)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acme-corp/storefront"
                    value={prRepo}
                    onChange={(e) => setPrRepo(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    placeholder="ghp_... (leave empty if configured on project)"
                    value={prToken}
                    onChange={(e) => setPrToken(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Requires repo write permission to create branch and commit test file.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Base Branch</label>
                  <input
                    type="text"
                    value={prBaseBranch}
                    onChange={(e) => setPrBaseBranch(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowPrModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-border text-zinc-400 hover:text-white text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingPr}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <GitBranch className={`w-3.5 h-3.5 ${creatingPr ? 'animate-spin' : ''}`} />
                    <span>{creatingPr ? 'Opening Pull Request...' : 'Open Pull Request'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
