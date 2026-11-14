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
  AlertCircle,
  GitBranch,
  Users,
  UserPlus,
  Shield,
  X,
  Crown,
  Mail,
  Clock
} from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Team & RBAC Modal State
  const [teamModalProject, setTeamModalProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState(null);

  // Create Project State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('*');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubToken, setGithubToken] = useState('');
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
        github_repo: githubRepo.trim() || undefined,
        github_token: githubToken.trim() || undefined,
      });

      const newProj = res.data?.project;
      setShowCreateModal(false);
      setProjectName('');
      setAllowedDomains('*');
      setWebhookUrl('');
      setGithubRepo('');
      setGithubToken('');
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

  const openTeamModal = (project) => {
    setTeamModalProject(project);
    setTeamFeedback(null);
    setInviteEmail('');
    setInviteRole('MEMBER');
    fetchTeamMembers(project.id);
  };

  const fetchTeamMembers = async (projectId) => {
    setLoadingTeam(true);
    try {
      const res = await api.get(`/projects/${projectId}/members`);
      setTeamMembers(res.data?.members || []);
      setPendingInvitations(res.data?.pendingInvitations || []);
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.message || 'Failed to load team members' });
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) return;
    setInviting(true);
    setTeamFeedback(null);

    try {
      const res = await api.post(`/projects/${teamModalProject.id}/members/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setTeamFeedback({ type: 'success', message: res.data?.message || 'Member processed successfully!' });
      setInviteEmail('');
      fetchTeamMembers(teamModalProject.id);
      fetchProjects();
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.message || 'Failed to invite team member' });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateMemberRole = async (targetUserId, newRole) => {
    setTeamFeedback(null);
    try {
      await api.patch(`/projects/${teamModalProject.id}/members/${targetUserId}`, {
        role: newRole,
      });
      fetchTeamMembers(teamModalProject.id);
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.message || 'Could not update role' });
    }
  };

  const handleRemoveMember = async (targetUserId, email) => {
    if (!confirm(`Are you sure you want to remove ${email} from this project?`)) return;
    setTeamFeedback(null);
    try {
      await api.delete(`/projects/${teamModalProject.id}/members/${targetUserId}`);
      fetchTeamMembers(teamModalProject.id);
      fetchProjects();
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.message || 'Could not remove member' });
    }
  };

  const handleRevokeInvitation = async (invitationId) => {
    setTeamFeedback(null);
    try {
      await api.delete(`/projects/${teamModalProject.id}/invitations/${invitationId}`);
      fetchTeamMembers(teamModalProject.id);
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.message || 'Could not revoke invitation' });
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
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white tracking-tight">{proj.name}</h3>
                    {proj.user_role === 'OWNER' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <Crown className="w-3 h-3 text-yellow-400" />
                        <span>OWNER</span>
                      </span>
                    )}
                    {proj.user_role === 'ADMIN' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <Shield className="w-3 h-3" />
                        <span>ADMIN</span>
                      </span>
                    )}
                    {proj.user_role === 'MEMBER' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        MEMBER
                      </span>
                    )}
                    {proj.user_role === 'VIEWER' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        VIEWER
                      </span>
                    )}
                  </div>
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
                  {(proj.user_role === 'OWNER' || proj.user_role === 'ADMIN') && (
                    <button
                      onClick={() => handleRotateKey(proj.id, proj.name)}
                      title="Rotate API Key"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {proj.user_role === 'OWNER' && (
                    <button
                      onClick={() => handleDelete(proj.id, proj.name)}
                      title="Delete Project"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Team Members & RBAC Row */}
              <div className="flex items-center justify-between p-3 bg-surface-elevated/40 border border-border-subtle rounded-lg text-xs">
                <div className="flex items-center space-x-2 text-zinc-300">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="font-medium">{proj.member_count || 1} Team Member{(proj.member_count || 1) > 1 ? 's' : ''}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openTeamModal(proj)}
                  className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Manage Team</span>
                </button>
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

              {/* GitHub Integration Status */}
              <div className="text-xs pt-2 border-t border-border-subtle flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-zinc-300 font-medium">
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                  <span>GitHub PR Integration:</span>
                </div>
                <div className="font-mono text-[11px]">
                  {proj.github_repo ? (
                    <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <span>{proj.github_repo}</span>
                      {proj.has_github_token && <span className="text-[10px] text-zinc-500">(Token linked)</span>}
                    </span>
                  ) : (
                    <span className="text-zinc-500">Optional</span>
                  )}
                </div>
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

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">GitHub Repository (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp/storefront"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">GitHub Personal Access Token (Optional)</label>
                <input
                  type="password"
                  placeholder="ghp_... for 1-click automated Pull Requests"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Enables opening automated Pull Requests with synthesized reproduction tests directly into your repo.
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

      {/* Modal: Team Management & RBAC */}
      {teamModalProject && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl w-full shadow-2xl relative my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Team & RBAC Management</span>
                    <span className="text-xs text-zinc-400 font-normal">({teamModalProject.name})</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Manage team access, assign fine-grained roles, and collaborate securely.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTeamModalProject(null)}
                className="p-1.5 rounded-lg hover:bg-surface-elevated text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Feedback Alert */}
            {teamFeedback && (
              <div className={`mb-4 p-3 rounded-lg text-xs flex items-center space-x-2 ${
                teamFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {teamFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{teamFeedback.message}</span>
              </div>
            )}

            {/* Invite New Member Form (Restricted to OWNER and ADMIN) */}
            {['OWNER', 'ADMIN'].includes(teamModalProject.user_role) ? (
              <div className="p-4 bg-surface-elevated/40 border border-border-subtle rounded-lg mb-6">
                <h4 className="text-xs font-semibold text-white mb-2 flex items-center space-x-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Invite New Team Member</span>
                </h4>
                <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {teamModalProject.user_role === 'OWNER' && (
                      <option value="ADMIN">ADMIN</option>
                    )}
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 shrink-0"
                  >
                    {inviting ? 'Inviting...' : 'Send Invite'}
                  </button>
                </form>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Existing registered users are granted instant access. Unregistered users receive a pending claim reserved for when they sign up.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-zinc-800/40 border border-border-subtle rounded-lg mb-4 text-xs text-zinc-400">
                You are currently a <span className="text-blue-400 font-semibold">{teamModalProject.user_role}</span>. Contact a project Owner or Admin to invite new members.
              </div>
            )}

            {/* Active Members Section */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Active Team Members ({teamMembers.length})
                </span>
                {loadingTeam && <span className="text-[11px] text-zinc-500">Refreshing...</span>}
              </div>

              <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden bg-background">
                {teamMembers.map((member) => (
                  <div key={member.id} className="p-3 flex items-center justify-between hover:bg-surface-elevated/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase">
                        {(member.name || member.email)[0]}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-white">{member.name || member.email}</span>
                          {member.role === 'OWNER' && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              <Crown className="w-2.5 h-2.5" />
                              <span>OWNER</span>
                            </span>
                          )}
                          {member.role === 'ADMIN' && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400">
                              <Shield className="w-2.5 h-2.5" />
                              <span>ADMIN</span>
                            </span>
                          )}
                          {member.role === 'MEMBER' && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400">
                              <Code2 className="w-2.5 h-2.5" />
                              <span>MEMBER</span>
                            </span>
                          )}
                          {member.role === 'VIEWER' && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 border border-zinc-500/30 text-zinc-400">
                              <Globe className="w-2.5 h-2.5" />
                              <span>VIEWER</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500">{member.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Role selection dropdown if current user is OWNER or ADMIN and target is not OWNER */}
                      {member.role !== 'OWNER' && ['OWNER', 'ADMIN'].includes(teamModalProject.user_role) ? (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                            className="px-2 py-1 bg-surface-elevated border border-border rounded text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500"
                          >
                            {teamModalProject.user_role === 'OWNER' && <option value="ADMIN">ADMIN</option>}
                            <option value="MEMBER">MEMBER</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id, member.email)}
                            title="Remove member"
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-zinc-500 capitalize">
                          {member.role === 'OWNER' ? 'Project Creator' : member.role.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Invitations Section (if any) */}
            {pendingInvitations.length > 0 && (
              <div className="space-y-3 mb-6">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Pending Invitations ({pendingInvitations.length})
                </span>
                <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden bg-background">
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="p-3 flex items-center justify-between hover:bg-surface-elevated/30 transition-colors">
                      <div className="flex items-center space-x-3">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-white">{inv.email}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              Invited as {inv.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500">
                            Expires {new Date(inv.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {['OWNER', 'ADMIN'].includes(teamModalProject.user_role) && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="px-2 py-1 rounded bg-surface-elevated hover:bg-red-500/10 border border-border text-[11px] text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RBAC Role Capabilities Matrix */}
            <div className="p-3 bg-surface-elevated/30 border border-border-subtle rounded-lg text-[11px] text-zinc-400 space-y-1.5">
              <span className="font-semibold text-zinc-300 block">RBAC Role Permissions:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2 rounded bg-background border border-border">
                  <span className="font-bold text-amber-400 block mb-0.5">OWNER</span>
                  <span>Full control, billing, project deletion, all admin powers.</span>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <span className="font-bold text-purple-400 block mb-0.5">ADMIN</span>
                  <span>Invite & manage members, rotate keys, update settings.</span>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <span className="font-bold text-blue-400 block mb-0.5">MEMBER</span>
                  <span>Triage bugs, run cloud tests, create GitHub PRs.</span>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <span className="font-bold text-zinc-400 block mb-0.5">VIEWER</span>
                  <span>Read-only access to incidents and verification runs.</span>
                </div>
              </div>
            </div>

            {/* Modal Close Button */}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setTeamModalProject(null)}
                className="px-4 py-1.5 rounded-lg border border-border bg-surface-elevated text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
