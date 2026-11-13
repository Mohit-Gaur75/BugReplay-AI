import React, { useState } from 'react';
import { MousePointer, Globe, AlertTriangle, Bug, ArrowRight, Clock, Terminal, Copy, Check } from 'lucide-react';

export default function VisualTimeline({ telemetry = [], errorDetails = null }) {
  const [copiedCurlIndex, setCopiedCurlIndex] = useState(null);

  const generateCurl = (item) => {
    const method = item.method || 'GET';
    const url = item.url;
    let curl = `curl -X ${method} '${url}'`;
    curl += ` \\\n  -H 'Content-Type: application/json'`;
    curl += ` \\\n  -H 'User-Agent: BugReplay-Debug-Client/1.0'`;
    if (item.requestBody) {
      const bodyStr = typeof item.requestBody === 'object' ? JSON.stringify(item.requestBody) : String(item.requestBody);
      curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
    }
    return curl;
  };

  const handleCopyCurl = (item, idx) => {
    const cmd = generateCurl(item);
    navigator.clipboard.writeText(cmd);
    setCopiedCurlIndex(idx);
    setTimeout(() => setCopiedCurlIndex(null), 2000);
  };

  if (!telemetry || telemetry.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-border rounded-xl">
        No chronological telemetry breadcrumbs recorded before crash.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
      {telemetry.map((item, index) => {
        const isClick = item.type === 'click';
        const isNetwork = item.type === 'network';
        const isConsole = item.type === 'console';
        const isReport = item.type === 'user_report';

        let badgeBg = 'bg-zinc-800 text-zinc-400 border-zinc-700';
        let Icon = MousePointer;

        if (isClick) {
          badgeBg = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
          Icon = MousePointer;
        } else if (isNetwork) {
          const isError = item.status >= 400 || item.status === 0;
          badgeBg = isError ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          Icon = Globe;
        } else if (isConsole) {
          badgeBg = item.level === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
          Icon = AlertTriangle;
        }

        return (
          <div key={index} className="relative group">
            {/* Timeline Node Dot */}
            <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border flex items-center justify-center ${badgeBg} bg-surface`}>
              <Icon className="w-2.5 h-2.5" />
            </div>

            {/* Breadcrumb Content Card */}
            <div className="bg-surface border border-border rounded-lg p-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1.5">
                <span className="uppercase font-semibold tracking-wider text-zinc-400">
                  Step {index + 1}: {item.type}
                </span>
                {item.timestamp && (
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </span>
                )}
              </div>

              {isClick && (
                <div className="text-xs">
                  <div className="text-zinc-200">
                    Clicked <span className="font-semibold text-white">{item.tagName?.toLowerCase()}</span>
                    {item.innerText && <span className="text-zinc-400"> "{item.innerText}"</span>}
                  </div>
                  {item.selector && (
                    <div className="mt-1 font-mono text-[11px] text-zinc-500 bg-background/50 px-2 py-0.5 rounded border border-border-subtle inline-block truncate max-w-full">
                      {item.selector}
                    </div>
                  )}
                </div>
              )}

              {isNetwork && (
                <div className="text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-zinc-300">{item.method || 'GET'}</span>
                    <span className="font-mono text-zinc-400 truncate max-w-xs">{item.url}</span>
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
                      (item.status >= 400 || item.status === 0) ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {item.status || 'TIMEOUT'}
                    </span>
                    {item.durationMs && <span className="text-[10px] text-zinc-500 font-mono">{item.durationMs}ms</span>}

                    <button
                      onClick={() => handleCopyCurl(item, index)}
                      className="ml-auto flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-elevated hover:bg-zinc-700 text-zinc-400 hover:text-white border border-border text-[10px] font-mono transition-colors"
                      title="Copy reproduction cURL command"
                    >
                      {copiedCurlIndex === index ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Terminal className="w-2.5 h-2.5 text-blue-400" />
                          <span>Copy cURL</span>
                        </>
                      )}
                    </button>
                  </div>
                  {item.requestBody && (
                    <div className="mt-2">
                      <div className="text-[10px] font-mono text-zinc-500 font-semibold uppercase">Request Payload:</div>
                      <pre className="mt-1 text-[11px] font-mono bg-background p-2 rounded border border-border text-zinc-300 overflow-x-auto">
                        {typeof item.requestBody === 'object' ? JSON.stringify(item.requestBody, null, 2) : String(item.requestBody)}
                      </pre>
                    </div>
                  )}
                  {item.responseBody && (
                    <div className="mt-2">
                      <div className="text-[10px] font-mono text-zinc-500 font-semibold uppercase">
                        {(item.status >= 400 || item.status === 0) ? 'Error Response Body:' : 'Response Body:'}
                      </div>
                      <pre className={`mt-1 text-[11px] font-mono bg-background p-2 rounded border border-border overflow-x-auto ${
                        (item.status >= 400 || item.status === 0) ? 'text-red-300' : 'text-emerald-300'
                      }`}>
                        {typeof item.responseBody === 'object' ? JSON.stringify(item.responseBody, null, 2) : String(item.responseBody)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {isConsole && (
                <div className="text-xs font-mono text-zinc-300">
                  <span className={`font-semibold ${item.level === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                    [{item.level}]:
                  </span>{' '}
                  {item.message}
                </div>
              )}

              {isReport && (
                <div className="text-xs text-zinc-200 bg-blue-500/10 border border-blue-500/20 p-2 rounded">
                  <span className="font-semibold text-blue-400">User Report Note:</span> {item.message}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Culprit Crash Terminal Step */}
      {errorDetails && (
        <div className="relative group">
          <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border border-red-500/40 bg-red-500/20 text-red-400 flex items-center justify-center">
            <Bug className="w-2.5 h-2.5" />
          </div>

          <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3">
            <div className="text-[11px] font-mono text-red-400 uppercase font-bold tracking-wider mb-1">
              Crash: {errorDetails.errorType || 'Error'}
            </div>
            <div className="text-xs text-red-200 font-medium">
              {errorDetails.errorMessage}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
