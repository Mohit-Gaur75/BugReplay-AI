import React from 'react';

const STATUS_CONFIGS = {
  OPEN: {
    label: 'Open',
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  },
  INVESTIGATING: {
    label: 'Investigating',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  },
  RESOLVED: {
    label: 'Resolved',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  },
  IGNORED: {
    label: 'Ignored',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
};

export default function StatusBadge({ status = 'OPEN' }) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.OPEN;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {config.label}
    </span>
  );
}
