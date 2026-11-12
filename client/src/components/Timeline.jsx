import React from 'react';
import { MousePointer, Globe, Terminal, Compass, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function Timeline({ telemetry = [] }) {
  if (!telemetry || telemetry.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border border-dashed border-dark-800 rounded-xl bg-dark-900/50">
        No breadcrumb telemetry recorded for this incident.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-dark-800">
      {telemetry.map((event, idx) => {
        const renderBadgeAndContent = () => {
          switch (event.type) {
            case 'click':
              return {
                icon: MousePointer,
                iconColor: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
                title: `Clicked ${event.tagName || 'Element'}`,
                subtitle: event.innerText ? `"${event.innerText}"` : null,
                details: (
                  <div className="mt-1 font-mono text-[11px] text-slate-400 bg-dark-950/60 p-2 rounded border border-dark-800/80">
                    <span className="text-slate-500">Selector:</span> {event.selector || event.tagName}
                    {event.coordinates && (
                      <span className="text-slate-500 ml-3">
                        (x: {event.coordinates.x}, y: {event.coordinates.y})
                      </span>
                    )}
                  </div>
                )
              };

            case 'network': {
              const isError = event.status >= 400 || event.status === 0;
              return {
                icon: Globe,
                iconColor: isError
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                title: `${event.method || 'GET'} ${event.url}`,
                subtitle: (
                  <span className="inline-flex items-center space-x-1.5 font-mono text-xs">
                    <span
                      className={`font-semibold ${
                        isError ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      HTTP {event.status || 'Failed'}
                    </span>
                    {event.durationMs !== undefined && (
                      <span className="text-slate-500">({event.durationMs}ms)</span>
                    )}
                  </span>
                ),
                details: event.responseBody ? (
                  <div className="mt-1 font-mono text-[11px] text-slate-300 bg-dark-950/80 p-2.5 rounded border border-dark-800/80 overflow-x-auto">
                    <div className="text-slate-500 text-[10px] uppercase font-semibold mb-1">Response Body:</div>
                    <pre className="text-rose-300 whitespace-pre-wrap">
                      {typeof event.responseBody === 'object'
                        ? JSON.stringify(event.responseBody, null, 2)
                        : String(event.responseBody)}
                    </pre>
                  </div>
                ) : null
              };
            }

            case 'console':
              return {
                icon: Terminal,
                iconColor: event.level === 'error'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                title: `Console ${event.level.toUpperCase()}`,
                subtitle: null,
                details: (
                  <div className="mt-1 font-mono text-[11px] text-slate-300 bg-dark-950/60 p-2 rounded border border-dark-800/80">
                    {event.message}
                  </div>
                )
              };

            case 'navigation':
              return {
                icon: Compass,
                iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                title: 'Page Navigation',
                subtitle: null,
                details: (
                  <div className="mt-1 text-[11px] text-slate-400 font-mono">
                    {event.from && <div className="text-slate-500">From: {event.from}</div>}
                    <div className="text-purple-300">To: {event.to}</div>
                  </div>
                )
              };

            default:
              return {
                icon: AlertCircle,
                iconColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                title: `Event: ${event.type || 'Custom'}`,
                subtitle: null,
                details: null
              };
          }
        };

        const { icon: Icon, iconColor, title, subtitle, details } = renderBadgeAndContent();

        return (
          <div key={idx} className="relative group">
            {/* Timeline Node Dot */}
            <div
              className={`absolute -left-[30px] top-1.5 w-6 h-6 rounded-full border flex items-center justify-center ${iconColor} shadow-md group-hover:scale-110 transition-transform`}
            >
              <Icon className="w-3 h-3" />
            </div>

            {/* Event Content Card */}
            <div className="bg-dark-900 border border-dark-800 rounded-lg p-3 hover:border-dark-700 transition-colors shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-200">{title}</span>
                  {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Step {idx + 1}
                </span>
              </div>
              {details}
            </div>
          </div>
        );
      })}
    </div>
  );
}
