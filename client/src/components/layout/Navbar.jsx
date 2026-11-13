import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Bug, Activity, Terminal, FolderKanban, CreditCard, LogOut, PlayCircle, ExternalLink } from 'lucide-react';

export default function Navbar({ activeTab, onTabChange }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'projects', label: 'Projects & Keys', icon: FolderKanban },
    { id: 'demo', label: 'Live Sandbox', icon: PlayCircle },
    { id: 'billing', label: 'Billing & Quotas', icon: CreditCard },
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-8">
          <div 
            onClick={() => onTabChange('dashboard')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Bug className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-bold text-base text-white tracking-tight">BugReplay</span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                AI
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-elevated text-white border border-border shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-elevated/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Context & Logout */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onTabChange('demo')}
            className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Try Sandbox</span>
          </button>

          {user && (
            <div className="flex items-center space-x-3 pl-3 border-l border-border">
              <div className="text-right">
                <div className="text-xs font-medium text-zinc-200 truncate max-w-[140px]">{user.email}</div>
                <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-end space-x-1">
                  <span>Plan:</span>
                  <span className="text-blue-400 font-semibold">{user.plan_tier || 'FREE'}</span>
                </div>
              </div>

              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
