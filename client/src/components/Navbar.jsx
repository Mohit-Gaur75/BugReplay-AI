import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bug, Play, Settings as SettingsIcon, LogOut, Layers, ExternalLink } from 'lucide-react';

export default function Navbar() {
  const { user, projects, activeProject, setActiveProject, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navLinks = [
    { name: 'Incidents', path: '/dashboard', icon: Bug },
    { name: 'Demo Sandbox', path: '/demo', icon: Play },
    { name: 'Settings & SDK', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <header className="border-b border-dark-800 bg-dark-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center space-x-8">
          <Link to="/dashboard" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Bug className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                BugReplay <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">AI</span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path || (link.path === '/dashboard' && location.pathname.startsWith('/incidents'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-dark-800 text-brand-400 border border-dark-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-850'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Project Selector, Plan Tier, & Account */}
        <div className="flex items-center space-x-4">
          {/* Project Switcher */}
          {projects.length > 0 && (
            <div className="hidden sm:flex items-center space-x-2 bg-dark-850 border border-dark-800 rounded-lg px-2.5 py-1">
              <Layers className="w-4 h-4 text-slate-400" />
              <select
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const selected = projects.find((p) => p.id === e.target.value);
                  if (selected) setActiveProject(selected);
                }}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-2"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-dark-900 text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Plan Pill */}
          <Link
            to="/settings"
            className="text-xs font-semibold uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            {user.plan_tier} Plan
          </Link>

          {/* User & Logout */}
          <div className="flex items-center space-x-3 border-l border-dark-800 pl-4">
            <span className="text-xs text-slate-400 hidden lg:inline-block truncate max-w-[150px]">
              {user.email}
            </span>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
