import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { 
  Bug, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Filter, 
  ArrowRight,
  Sparkles,
  Play
} from 'lucide-react';

export default function Dashboard() {
  const { token, activeProject } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchIncidents = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeProject) params.append('projectId', activeProject.id);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const res = await fetch(`/api/v1/incidents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIncidents(data.incidents || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [token, activeProject, statusFilter, search]);

  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Hero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-dark-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Incident Flight Recorder
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
              Live
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Production crashes transformed into reproducible Playwright E2E tests and AI diagnoses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/demo"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium text-sm shadow-lg shadow-brand-500/20 transition-all hover:scale-105"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Test Demo Sandbox</span>
          </Link>

          <button
            onClick={fetchIncidents}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh incidents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-dark-900 border border-dark-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Recorded</span>
            <Bug className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{pagination.total}</div>
          <div className="text-xs text-slate-500 mt-1">Across all sessions</div>
        </div>

        <div className="p-5 rounded-xl bg-dark-900 border border-dark-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Open Incidents</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">{openCount}</div>
          <div className="text-xs text-slate-500 mt-1">Awaiting investigation</div>
        </div>

        <div className="p-5 rounded-xl bg-dark-900 border border-dark-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resolved</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{resolvedCount}</div>
          <div className="text-xs text-slate-500 mt-1">Tests verified</div>
        </div>

        <div className="p-5 rounded-xl bg-dark-900 border border-dark-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Playwright Tests</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-2">{pagination.total}</div>
          <div className="text-xs text-slate-500 mt-1">100% synthesized</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center p-1 bg-dark-900 border border-dark-800 rounded-lg">
          {['ALL', 'OPEN', 'RESOLVED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-dark-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search error, URL, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-dark-900 border border-dark-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* Incidents Stream Table / List */}
      <div className="rounded-xl border border-dark-800 bg-dark-900 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-sm">Fetching recorded flight logs...</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center mx-auto text-slate-500">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">No incidents found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {search || statusFilter !== 'ALL'
                  ? 'Try clearing your filters or search terms.'
                  : 'Test the SDK live by triggering a crash in the Demo Sandbox.'}
              </p>
            </div>
            <Link
              to="/demo"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Go to Demo Sandbox</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {incidents.map((incident) => (
              <Link
                key={incident.id}
                to={`/incidents/${incident.id}`}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-dark-850/60 transition-colors gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-dark-800 text-rose-300 border border-dark-700">
                      {incident.error_type || 'Error'}
                    </span>
                    <StatusBadge status={incident.status} />
                    <span className="text-[11px] text-slate-500 font-mono truncate">
                      {incident.id}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-brand-400 transition-colors truncate">
                    {incident.error_message}
                  </h3>

                  <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
                    <span className="truncate max-w-[280px]">{incident.page_url}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(incident.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center">
                  <span className="text-xs font-medium text-brand-400 group-hover:translate-x-1 transition-transform flex items-center space-x-1">
                    <span>Inspect Playwright Test</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
