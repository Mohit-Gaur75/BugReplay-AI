import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  FolderKanban, 
  Plus, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  Globe, 
  Code2, 
  AlertTriangle,
  ExternalLink,
  Bell,
  Send,
  AlertCircle
} from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create Project State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('*');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [creating, setCreating] = useState(false);

  // Webhook action states
  const [editingWebhookId, setEditingWebhookId] = useState(null);
  const [tempWebhookUrl, setTempWebhookUrl] = useState('');
  const [testingWebhook, setTestingWebhook] = useState({});
  const [webhookFeedback, setWebhookFeedback] = useState({});

  // New Key Modal (shows raw key once)
  const [newKeyModal, setNewKeyModal] = useState(null); // { key, name }
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects');
      setProjects(res.data?.projects || []);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/projects', {
        name: projectName,
        allowed_domains: allowedDomains,
        webhook_url: webhookUrl.trim() || undefined,
      });

      const newProj = res.data?.project;
      setShowCreateModal(false);
      setProjectName('');
      setAllowedDomains('*');
      setWebhookUrl('');
      fetchProjects();

      // Show raw API key once
      setNewKeyModal({
        name: newProj.name,
        key: newProj.api_key,
      });
    } catch (err) {
      alert(`Could not create project: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveWebhook = async (projectId) => {
    try {
      await api.patch(`/projects/${projectId}`, {
        webhook_url: tempWebhookUrl.trim() || null
      });
      setEditingWebhookId(null);
      fetchProjects();
    } catch (err) {
      alert(`Could not update webhook: ${err.message}`);
    }
  };

  const handleTestWebhook = async (projectId) => {
    setTestingWebhook(prev => ({ ...prev, [projectId]: true }));
    try {
      const res = await api.post(`/projects/${projectId}/test-webhook`);
      setWebhookFeedback(prev => ({
        ...prev,
        [projectId]: { type: 'success', message: res.data?.message || 'Test alert dispatched successfully!' }
      }));
      setTimeout(() => {
        setWebhookFeedback(prev => ({ ...prev, [projectId]: null }));
      }, 4000);
    } catch (err) {
      setWebhookFeedback(prev => ({
        ...prev,
        [projectId]: { type: 'error', message: err.message || 'Failed to dispatch test alert' }
      }));
      setTimeout(() => {
        setWebhookFeedback(prev => ({ ...prev, [projectId]: null }));
      }, 5000);
    } finally {
      setTestingWebhook(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleRotateKey = async (projectId, projName) => {
    if (!confirm(`Are you sure you want to rotate the API key for "${projName}"? Any existing SDK installations using the old key will stop reporting immediately.`)) {
      return;
    }

    try {
      const res = await api.post(`/projects/${projectId}/rotate-key`);
      fetchProjects();
      setNewKeyModal({
        name: projName,
        key: res.data?.new_api_key,
      });
    } catch (err) {
      alert(`Could not rotate key: ${err.message}`);
    }
  };

  const handleDelete = async (projectId, projName) => {
    if (!confirm(`Are you sure you want to permanently delete project "${projName}" and all associated bug telemetry? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/projects/${projectId}`);
      fetchProjects();
    } catch (err) {
      alert(`Could not delete project: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Project Management & API Keys</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your registered applications, domain policies, and secure ingestion keys.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-2 transition-all shadow"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-500">Loading projects...</div>
      ) : error ? (
        <div className="p-12 text-center text-xs text-red-400">{error}</div>
      ) : projects.length === 0 ? (
        <div className="p-16 text-center bg-surface border border-border rounded-xl">
          <FolderKanban className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No projects yet</h3>
          <p className="text-xs text-zinc-400 mt-1 mb-6">Create your first project to generate an SDK API key.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((proj) => (
            <div key={proj.id} className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">{proj.name}</h3>
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-500 mt-1">
                    <span>ID: {proj.id.slice(0, 8)}</span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Globe className="w-3 h-3" />
                      <span>{proj.allowed_domains}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleRotateKey(proj.id, proj.name)}
                    title="Rotate API Key"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(proj.id, proj.name)}
                    title="Delete Project"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Usage & Incidents Stats */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-elevated/50 border border-border-subtle rounded-lg text-xs">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Total Incidents</span>
                  <span className="font-mono text-white font-bold">{proj.incident_count}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Monthly Usage</span>
                  <span className="font-mono text-blue-400 font-bold">{proj.monthly_usage} / mo</span>
                </div>
              </div>

              {/* API Key Prefix */}
              <div className="text-xs">
                <span className="text-zinc-400 font-medium block mb-1">API Key (Hashed)</span>
                <div className="flex items-center space-x-2 font-mono text-[11px] text-zinc-300 bg-background px-3 py-1.5 rounded border border-border">
                  <Key className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{proj.api_key_prefix}</span>
                </div>
              </div>

              {/* SDK Embed Snippet Box */}
              <div className="text-xs">
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="font-medium">SDK Embed Snippet</span>
                </div>
                <pre className="p-3 bg-background rounded border border-border font-mono text-[11px] text-blue-300 overflow-x-auto m-0 select-all">
                  {`<script src="http://localhost:5000/bugreplay.js" data-api-key="<YOUR_KEY>" defer></script>`}
                </pre>
              </div>

              {/* Webhook Alert Notifications */}
              <div className="text-xs pt-1 border-t border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 text-zinc-300 font-medium">
                    <Bell className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Incident Webhook Alerts</span>
                  </div>
                  {editingWebhookId !== proj.id && (
                    <button
                      onClick={() => {
                        setEditingWebhookId(proj.id);
                        setTempWebhookUrl(proj.webhook_url || '');
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300"
                    >
                      {proj.webhook_url ? 'Change' : '+ Add Webhook'}
                    </button>
                  )}
                </div>

                {editingWebhookId === proj.id ? (
                  <div className="space-y-2">
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/... or Discord webhook"
                      value={tempWebhookUrl}
                      onChange={(e) => setTempWebhookUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingWebhookId(null)}
                        className="px-2 py-1 rounded bg-surface-elevated border border-border text-[11px] text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveWebhook(proj.id)}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between bg-background px-3 py-1.5 rounded border border-border">
                      <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[280px]">
                        {proj.webhook_url || 'No webhook configured'}
                      </span>
                      {proj.webhook_url && (
                        <button
                          onClick={() => handleTestWebhook(proj.id)}
                          disabled={testingWebhook[proj.id]}
                          className="shrink-0 ml-2 px-2 py-0.5 rounded bg-surface-elevated hover:bg-zinc-700 border border-border text-[10px] font-medium text-zinc-300 hover:text-white flex items-center space-x-1 disabled:opacity-50"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>{testingWebhook[proj.id] ? 'Testing...' : 'Test'}</span>
                        </button>
                      )}
                    </div>

                    {webhookFeedback[proj.id] && (
                      <div className={`p-2 rounded text-[11px] flex items-center space-x-1.5 ${
                        webhookFeedback[proj.id].type === 'success' 
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}>
                        {webhookFeedback[proj.id].type === 'success' ? (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{webhookFeedback[proj.id].message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Project */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Create New Project</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter a project name to generate a cryptographically secure ingestion API key.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Web App"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Allowed Domains</label>
                <input
                  type="text"
                  placeholder="e.g. https://app.acme.com or *"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Use * to allow all origins, or comma-separated domains.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Webhook Alert URL (Optional)</label>
                <input
                  type="url"
                  placeholder="e.g. Slack incoming webhook or Discord webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Receive instant notifications in Slack, Discord, or your endpoint when incidents are captured.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border bg-surface-elevated text-xs text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New API Key Reveal (Shown ONCE) */}
      {newKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-yellow-500/40 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center space-x-2 text-yellow-400 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Save Your API Key Now</h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              For security, this raw key is never stored in plaintext and <strong>will not be shown again</strong>. Please copy it immediately.
            </p>

            <div className="p-3 bg-background border border-border rounded-lg flex items-center justify-between font-mono text-xs text-yellow-300 mb-4 select-all">
              <span className="truncate mr-2">{newKeyModal.key}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKeyModal.key);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="shrink-0 p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-xs text-zinc-400 mb-6">
              <span className="font-semibold text-zinc-200 block mb-1">Your Drop-In Embed Code:</span>
              <pre className="p-3 bg-background border border-border rounded font-mono text-[11px] text-blue-300 overflow-x-auto m-0 select-all">
                {`<script \n  src="http://localhost:5000/bugreplay.js" \n  data-api-key="${newKeyModal.key}" \n  defer>\n</script>`}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setNewKeyModal(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow"
              >
                I have copied my key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
