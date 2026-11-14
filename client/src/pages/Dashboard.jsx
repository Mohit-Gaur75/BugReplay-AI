import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  Bug, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  ArrowUpRight, 
  PlayCircle, 
  Sparkles, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function Dashboard({ onSelectIncident, onGoToDemo, onGoToProjects }) {
  const [incidents, setIncidents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    synthesized: 0,
  });

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });
      if (statusFilter) query.append('status', statusFilter);
      if (search) query.append('search', search);

      const res = await api.get(`/incidents?${query.toString()}`);
      const list = res.data?.incidents || [];
      setIncidents(list);
      setPagination(res.data?.pagination || pagination);

      // Compute simple metrics from current page/total
      const openCount = list.filter((i) => i.status === 'OPEN').length;
      const resolvedCount = list.filter((i) => i.status === 'RESOLVED').length;
      const synthCount = list.filter((i) => i.generation_status === 'COMPLETED').length;

      setMetrics({
        total: res.data?.pagination?.total || list.length,
        open: openCount,
        resolved: resolvedCount,
        synthesized: synthCount,
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [pagination.page, statusFilter]);

  // Real-Time SSE Stream Integration
  useEffect(() => {
    const token = localStorage.getItem('bugreplay_token');
    if (!token) return;

    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/v1/incidents/stream?token=${encodeURIComponent(token)}`);

      eventSource.addEventListener('incident.created', () => {
        fetchIncidents();
      });

      eventSource.addEventListener('incident.deduplicated', () => {
        fetchIncidents();
      });

      eventSource.addEventListener('synthesis.completed', () => {
        fetchIncidents();
      });

      eventSource.addEventListener('test_run.completed', () => {
        fetchIncidents();
      });
    } catch (e) {
      console.warn('Could not establish real-time SSE stream:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchIncidents();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">OPEN</span>;
      case 'INVESTIGATING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">INVESTIGATING</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">RESOLVED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-700 text-zinc-300">IGNORED</span>;
    }
  };

  const getVerificationBadge = (testStatus) => {
    switch (testStatus) {
      case 'REPRODUCED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Reproduced</span>
          </span>
        );
      case 'PASSED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Passed</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <span>Running...</span>
          </span>
        );
      case 'FAILED':
      case 'ERROR':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Error</span>
          </span>
        );
      default:
        return <span className="text-[10px] font-mono text-zinc-500">Untested</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Metric Cards Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Total Captured</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{metrics.total}</div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Open Issues</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{metrics.open}</div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Resolved Bugs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{metrics.resolved}</div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>AI Tests Synthesized</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">{metrics.synthesized}</div>
        </div>
      </div>

      {/* Incident Stream Panel */}
      <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 bg-surface-elevated/50 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Status Tabs & Realtime Indicator */}
          <div className="flex items-center space-x-3 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center space-x-1">
              {['', 'OPEN', 'INVESTIGATING', 'RESOLVED'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                    statusFilter === status
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {status || 'All Incidents'}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE SYNC</span>
            </div>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search error or URL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-48 sm:w-64 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-surface-elevated hover:bg-zinc-800 border border-border text-xs text-zinc-300 font-medium rounded-lg transition-colors"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Incidents Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Loading captured incidents...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-xs text-red-400">
              {error}
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <Bug className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No incidents recorded yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-6">
                Test the SDK in our live interactive sandbox or add the embed snippet to your application.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={onGoToDemo}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-2 transition-all shadow"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Launch Live Demo Sandbox</span>
                </button>
                <button
                  onClick={onGoToProjects}
                  className="px-4 py-2 rounded-lg bg-surface-elevated border border-border text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                >
                  View SDK Embed Keys
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/20 text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Error Message & Page</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">AI Test</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Captured</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    onClick={() => onSelectIncident(incident.id)}
                    className="hover:bg-surface-elevated/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(incident.status)}
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors truncate">
                          {incident.error_message}
                        </span>
                        {(incident.occurrence_count || 1) > 1 && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex-shrink-0"
                            title={`Captured ${incident.occurrence_count} recurring instances`}
                          >
                            {incident.occurrence_count}x
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5 flex items-center space-x-2">
                        <span className="truncate">{incident.page_url}</span>
                        {incident.device_health?.network && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 border ${
                            incident.device_health.network.online === false
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}>
                            {incident.device_health.network.online === false
                              ? 'OFFLINE'
                              : (incident.device_health.network.effectiveType || 'ONLINE').toUpperCase()}
                          </span>
                        )}
                        {incident.device_health?.battery?.charging && (
                          <span className="text-[10px] text-emerald-400 shrink-0" title="Device was charging">
                            ⚡
                          </span>
                        )}
                        {incident.viewport && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-zinc-400 bg-surface border border-border shrink-0">
                            {parseInt(incident.viewport.split('x')[0], 10) < 768 ? 'Mobile' : 'Desktop'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                      {incident.project_name || 'Project'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {incident.generation_status === 'COMPLETED' ? (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </span>
                      ) : incident.generation_status === 'PROCESSING' ? (
                        <span className="text-[11px] font-mono text-blue-400 animate-pulse">Generating...</span>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-500">Pending</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getVerificationBadge(incident.test_status)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-[11px] font-mono text-zinc-500">
                      {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center text-xs text-blue-400 group-hover:translate-x-0.5 transition-transform">
                        <span>Debug</span>
                        <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-3 bg-surface-elevated/30 border-t border-border flex items-center justify-between text-xs text-zinc-400">
            <div>
              Page <span className="font-medium text-white">{pagination.page}</span> of{' '}
              <span className="font-medium text-white">{pagination.totalPages}</span> ({pagination.total} total)
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="p-1 rounded bg-surface border border-border disabled:opacity-40 hover:bg-zinc-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="p-1 rounded bg-surface border border-border disabled:opacity-40 hover:bg-zinc-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
