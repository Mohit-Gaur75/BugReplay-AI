import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bug, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('demo@bugreplay.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('demo@bugreplay.dev');
    setPassword('password123');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 p-8 rounded-2xl bg-dark-900 border border-dark-800 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
            <Bug className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to BugReplay AI</h2>
          <p className="text-xs text-slate-400">
            Sign in to inspect your production crash flight logs and synthesized tests.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-dark-950 border border-dark-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
              placeholder="developer@company.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-dark-950 border border-dark-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center space-x-1.5"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Account Quick-Fill Card */}
        <div className="p-3.5 rounded-xl bg-dark-850 border border-dark-800 text-center space-y-2">
          <div className="flex items-center justify-center space-x-1.5 text-xs text-brand-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Demo Credentials</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            demo@bugreplay.dev / password123
          </p>
          <button
            type="button"
            onClick={handleDemoFill}
            className="text-xs text-slate-300 hover:text-white underline font-medium"
          >
            Fill Demo Credentials
          </button>
        </div>

        <div className="text-center text-xs text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-400 hover:underline font-medium">
            Register free
          </Link>
        </div>
      </div>
    </div>
  );
}
