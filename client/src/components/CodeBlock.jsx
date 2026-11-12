import React, { useState } from 'react';
import { Copy, Check, Download, FileCode } from 'lucide-react';

export default function CodeBlock({ code = '', filename = 'test.spec.js', downloadUrl = null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.location.href = downloadUrl;
      return;
    }
    const blob = new Blob([code], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = code.trim().split('\n');

  return (
    <div className="rounded-xl border border-dark-800 bg-dark-900 overflow-hidden shadow-2xl">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-dark-850 border-b border-dark-800 text-xs">
        <div className="flex items-center space-x-2 text-slate-300">
          <FileCode className="w-4 h-4 text-brand-400" />
          <span className="font-mono font-medium">{filename}</span>
          <span className="text-slate-500 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-dark-800">
            Playwright E2E
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-white transition-colors"
            title="Copy Playwright Script to Clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 border border-brand-500/30 transition-colors"
            title="Download .spec.js file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .spec.js</span>
          </button>
        </div>
      </div>

      {/* Code Body with line numbers */}
      <div className="p-4 overflow-x-auto text-xs font-mono leading-relaxed bg-[#0b0d14]">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-dark-800/40 transition-colors">
                <td className="w-10 pr-4 text-right text-slate-600 select-none align-top font-mono">
                  {idx + 1}
                </td>
                <td className="text-slate-200 whitespace-pre font-mono">
                  {formatLineHighlight(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Lightweight syntax colorizer
function formatLineHighlight(line) {
  if (line.trim().startsWith('//')) {
    return <span className="text-slate-500 italic">{line}</span>;
  }
  if (line.includes('import ') || line.includes('from ')) {
    return <span className="text-purple-400">{line}</span>;
  }
  if (line.includes('test(') || line.includes('test.describe(')) {
    return <span className="text-amber-300 font-semibold">{line}</span>;
  }
  if (line.includes('await page.route')) {
    return <span className="text-rose-400">{line}</span>;
  }
  if (line.includes('await page.goto') || line.includes('await page.locator')) {
    return <span className="text-cyan-300">{line}</span>;
  }
  if (line.includes('await expect(')) {
    return <span className="text-emerald-400 font-semibold">{line}</span>;
  }
  return line;
}
