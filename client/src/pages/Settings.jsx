import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  User, 
  KeyRound, 
  ShieldCheck, 
  CreditCard, 
  Clock, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Code2
} from 'lucide-react';

export default function Settings({ onGoToBilling }) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        const res = await api.get('/auth/audit-logs');
        setAuditLogs(res.data?.audit_logs || []);
      } catch (e) {
        console.warn('Could not load audit logs:', e);
      } finally {
        setLogsLoading(false);
      }
    }

    loadAuditLogs();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters' });
      return;
    }

    setPasswordLoading(true);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Refresh audit logs
      const logsRes = await api.get('/auth/audit-logs');
      setAuditLogs(logsRes.data?.audit_logs || []);
    } catch (err) {
      setPasswordStatus({ type: 'error', message: err.message || 'Could not update password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Account & Platform Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage your developer profile, account security, subscription tier, and security audit log.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Profile & Security */}
        <div className="lg:col-span-7 space-y-8">
          {/* Profile Overview */}
          <div className="p-6 bg-surface border border-border rounded-xl space-y-4">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Developer Profile</h3>
                <p className="text-[11px] text-zinc-400">Your account identity</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block text-[11px] mb-1">Email Address</span>
                <span className="font-mono text-zinc-200">{user?.email}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px] mb-1">User ID</span>
                <span className="font-mono text-zinc-400 text-[10px] truncate block">{user?.id}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px] mb-1">Current Tier</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {user?.plan_tier || 'FREE'} PLAN
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px] mb-1">Account Created</span>
                <span className="font-mono text-zinc-400 text-[11px]">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Security (Change Password) */}
          <div className="p-6 bg-surface border border-border rounded-xl space-y-4">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Account Security</h3>
                <p className="text-[11px] text-zinc-400">Update your account login password</p>
              </div>
            </div>

            {passwordStatus && (
              <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                passwordStatus.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'
              }`}>
                {passwordStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{passwordStatus.message}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 chars"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-surface-elevated hover:bg-zinc-800 border border-border text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (5 cols): Plan overview & Audit Trail */}
        <div className="lg:col-span-5 space-y-8">
          {/* Plan Summary Card */}
          <div className="p-6 bg-surface border border-border rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Subscription & Limits</h3>
              </div>
              <button
                onClick={onGoToBilling}
                className="text-[11px] text-blue-400 font-medium hover:underline"
              >
                Manage Plan -&gt;
              </button>
            </div>

            <div className="p-3 bg-surface-elevated/50 border border-border rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Plan Tier:</span>
                <span className="font-bold text-white font-mono">{user?.plan_tier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Monthly Quota:</span>
                <span className="font-mono text-zinc-300">
                  {user?.plan_tier === 'FREE' ? '50 bugs' : user?.plan_tier === 'PRO' ? '1,000 bugs' : '5,000 bugs'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Telemetry Retention:</span>
                <span className="font-mono text-zinc-300">
                  {user?.plan_tier === 'FREE' ? '7 Days' : '30 Days'}
                </span>
              </div>
            </div>
          </div>

          {/* Security Audit Trail */}
          <div className="p-6 bg-surface border border-border rounded-xl space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-border">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Security Audit Trail</h3>
            </div>

            {logsLoading ? (
              <div className="text-xs text-zinc-500 text-center py-4">Loading audit events...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-4">No security events recorded yet.</div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-background border border-border rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] text-zinc-300">{log.action}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.details && (
                      <div className="text-[11px] text-zinc-400 font-mono truncate">
                        {log.details.projectName || log.details.newPlan || JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
