import React, { useState } from 'react';
import { Copy, Check, Download, Terminal, Layers } from 'lucide-react';
import { convertToCypress, convertToPuppeteer, convertToRTL } from '../../utils/frameworkConverter.js';

export default function CodeBlock({ code, filename = 'bug-replay.spec.js', incidentId = null, incident = null }) {
  const [activeFramework, setActiveFramework] = useState('playwright');
  const [copied, setCopied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);

  // Derive current code and filename according to active framework
  let currentCode = code;
  let currentFilename = filename;

  if (activeFramework === 'cypress') {
    currentCode = convertToCypress(code, incident);
    currentFilename = filename.replace(/\.spec\.js$/, '.cy.js');
  } else if (activeFramework === 'puppeteer') {
    currentCode = convertToPuppeteer(code, incident);
    currentFilename = filename.replace(/\.spec\.js$/, '.puppeteer.js');
  } else if (activeFramework === 'rtl') {
    currentCode = convertToRTL(code, incident);
    currentFilename = filename.replace(/\.spec\.js$/, '.test.jsx');
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFilename;
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
      {/* Code Header with Framework Tabs */}
      <div className="px-4 py-2.5 bg-surface-elevated/70 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>

          {/* Framework Switcher Tabs */}
          <div className="flex items-center space-x-1 bg-background/80 p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setActiveFramework('playwright')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                activeFramework === 'playwright'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Playwright
            </button>
            <button
              onClick={() => setActiveFramework('cypress')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                activeFramework === 'cypress'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cypress
            </button>
            <button
              onClick={() => setActiveFramework('puppeteer')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                activeFramework === 'puppeteer'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Puppeteer
            </button>
            <button
              onClick={() => setActiveFramework('rtl')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                activeFramework === 'rtl'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              React Testing Library
            </button>
          </div>

          <span className="text-xs font-mono text-zinc-400 pl-1">{currentFilename}</span>
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
            <span>Download {currentFilename.slice(currentFilename.lastIndexOf('.'))}</span>
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto max-h-[500px] text-xs font-mono leading-relaxed text-zinc-300">
        <pre className="m-0 whitespace-pre">
          <code>{currentCode}</code>
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
