import React, { useState } from 'react';
import { Copy, Check, Download, Terminal } from 'lucide-react';

export default function CodeBlock({ code, filename = 'bug-replay.spec.js', incidentId = null }) {
  const [copied, setCopied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const cliCommand = `npx bugreplay run ${incidentId || '<incident-id>'}`;

  const handleCliCopy = () => {
    navigator.clipboard.writeText(cliCommand);
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-[#0d1117] overflow-hidden shadow-2xl">
      {/* Code Header */}
      <div className="px-4 py-2.5 bg-surface-elevated/70 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-mono text-zinc-400 pl-2">{filename}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Script'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .spec.js</span>
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto max-h-[500px] text-xs font-mono leading-relaxed text-zinc-300">
        <pre className="m-0 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>

      {/* CLI Reproduction Banner */}
      {incidentId && (
        <div className="px-4 py-2.5 bg-surface border-t border-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400 truncate mr-2">
            <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Run locally: <span className="text-blue-300">{cliCommand}</span></span>
          </div>

          <button
            onClick={handleCliCopy}
            className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-white px-2 py-0.5 rounded border border-border bg-surface-elevated transition-colors"
          >
            {cliCopied ? 'Copied!' : 'Copy CLI'}
          </button>
        </div>
      )}
    </div>
  );
}
