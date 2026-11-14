import React, { useState, useMemo } from 'react';
import { 
  MousePointer, 
  Globe, 
  AlertTriangle, 
  Bug, 
  ArrowRight, 
  Clock, 
  Terminal, 
  Copy, 
  Check,
  Search,
  X,
  Layers,
  Compass,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';

export default function VisualTimeline({ telemetry = [], errorDetails = null }) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCurlIndex, setCopiedCurlIndex] = useState(null);
  const [expandedPayloads, setExpandedPayloads] = useState({});

  // 1. Dynamic category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: telemetry.length,
      click: 0,
      network: 0,
      console: 0,
      navigation: 0,
      user_report: 0,
    };
    for (const item of telemetry) {
      if (counts[item.type] !== undefined) {
        counts[item.type]++;
      }
    }
    return counts;
  }, [telemetry]);

  // 2. Filtered telemetry items with original indices preserved
  const filteredTelemetry = useMemo(() => {
    return telemetry
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter((item) => {
        // Category Filter
        if (activeCategory !== 'ALL' && item.type !== activeCategory) {
          return false;
        }

        // Search Query Filter
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchesType = item.type?.toLowerCase().includes(q);
          const matchesTag = item.tagName?.toLowerCase().includes(q);
          const matchesText = item.innerText?.toLowerCase().includes(q);
          const matchesSelector = item.selector?.toLowerCase().includes(q);
          const matchesId = item.id?.toLowerCase().includes(q);
          const matchesUrl = item.url?.toLowerCase().includes(q);
          const matchesMethod = item.method?.toLowerCase().includes(q);
          const matchesStatus = String(item.status || '').includes(q);
          const matchesMessage = item.message?.toLowerCase().includes(q);
          const matchesLevel = item.level?.toLowerCase().includes(q);
          const matchesReqBody = item.requestBody && JSON.stringify(item.requestBody).toLowerCase().includes(q);
          const matchesResBody = item.responseBody && JSON.stringify(item.responseBody).toLowerCase().includes(q);

          return (
            matchesType ||
            matchesTag ||
            matchesText ||
            matchesSelector ||
            matchesId ||
            matchesUrl ||
            matchesMethod ||
            matchesStatus ||
            matchesMessage ||
            matchesLevel ||
            matchesReqBody ||
            matchesResBody
          );
        }

        return true;
      });
  }, [telemetry, activeCategory, searchQuery]);

  const togglePayloadExpand = (index, key) => {
    const compoundKey = `${index}-${key}`;
    setExpandedPayloads((prev) => ({
      ...prev,
      [compoundKey]: !prev[compoundKey],
    }));
  };

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

  const formatDelta = (deltaMs) => {
    if (deltaMs === null || deltaMs === undefined || isNaN(deltaMs)) return null;
    if (deltaMs < 1000) return `+${deltaMs}ms`;
    return `+${(deltaMs / 1000).toFixed(1)}s`;
  };

  if (!telemetry || telemetry.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-border rounded-xl">
        No chronological telemetry breadcrumbs recorded before crash.
      </div>
    );
  }

  const isFiltering = activeCategory !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="space-y-4">
      {/* Search & Category Filter Toolbar */}
      <div className="space-y-3 pb-3 border-b border-border-subtle">
        {/* Real-Time Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search breadcrumbs (selector, endpoint, payload, text, status)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-background border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills & Results Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
            {/* ALL */}
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                activeCategory === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-elevated text-zinc-400 hover:text-white border border-border'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>All ({categoryCounts.ALL})</span>
            </button>

            {/* Clicks */}
            <button
              type="button"
              onClick={() => setActiveCategory('click')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                activeCategory === 'click'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-elevated text-zinc-400 hover:text-white border border-border'
              }`}
            >
              <MousePointer className="w-3 h-3 text-blue-400" />
              <span>Clicks ({categoryCounts.click})</span>
            </button>

            {/* Network */}
            <button
              type="button"
              onClick={() => setActiveCategory('network')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                activeCategory === 'network'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-elevated text-zinc-400 hover:text-white border border-border'
              }`}
            >
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Network ({categoryCounts.network})</span>
            </button>

            {/* Console */}
            <button
              type="button"
              onClick={() => setActiveCategory('console')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                activeCategory === 'console'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-elevated text-zinc-400 hover:text-white border border-border'
              }`}
            >
              <Terminal className="w-3 h-3 text-yellow-400" />
              <span>Console ({categoryCounts.console})</span>
            </button>

            {/* Navigation (if present) */}
            {categoryCounts.navigation > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory('navigation')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                  activeCategory === 'navigation'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-surface-elevated text-zinc-400 hover:text-white border border-border'
                }`}
              >
                <Compass className="w-3 h-3 text-purple-400" />
                <span>Nav ({categoryCounts.navigation})</span>
              </button>
            )}

            {/* User Reports (if present) */}
            {categoryCounts.user_report > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory('user_report')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                  activeCategory === 'user_report'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-surface-elevated text-zinc-400 hover:text-white border border-border'
                }`}
              >
                <MessageSquare className="w-3 h-3 text-indigo-400" />
                <span>Notes ({categoryCounts.user_report})</span>
              </button>
            )}
          </div>

          {/* Results Summary & Reset */}
          <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-400">
            <span>
              Showing <strong className="text-white">{filteredTelemetry.length}</strong> of{' '}
              <strong className="text-zinc-300">{telemetry.length}</strong>
            </span>
            {isFiltering && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('ALL');
                  setSearchQuery('');
                }}
                className="text-blue-400 hover:text-blue-300 underline font-sans text-xs cursor-pointer ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State when filters yield 0 matches */}
      {filteredTelemetry.length === 0 ? (
        <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-border rounded-xl space-y-2">
          <Filter className="w-6 h-6 text-zinc-600 mx-auto" />
          <p>No telemetry breadcrumbs match your search criteria.</p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('ALL');
              setSearchQuery('');
            }}
            className="px-3 py-1 rounded bg-surface-elevated hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-border"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Chronological Timeline Feed */
        <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {filteredTelemetry.map((item, index) => {
            const isClick = item.type === 'click';
            const isNetwork = item.type === 'network';
            const isConsole = item.type === 'console';
            const isReport = item.type === 'user_report';
            const isNav = item.type === 'navigation';

            // Calculate relative delta time from previous filtered step
            const prevItem = index > 0 ? filteredTelemetry[index - 1] : null;
            const deltaMs = prevItem && prevItem.timestamp && item.timestamp
              ? Math.max(0, item.timestamp - prevItem.timestamp)
              : null;

            let badgeBg = 'bg-zinc-800 text-zinc-400 border-zinc-700';
            let Icon = MousePointer;

            if (isClick) {
              badgeBg = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
              Icon = MousePointer;
            } else if (isNetwork) {
              const isError = item.status >= 400 || item.status === 0;
              badgeBg = isError
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
              Icon = Globe;
            } else if (isConsole) {
              badgeBg = item.level === 'error'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
              Icon = AlertTriangle;
            } else if (isNav) {
              badgeBg = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
              Icon = Compass;
            } else if (isReport) {
              badgeBg = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
              Icon = MessageSquare;
            }

            const reqKey = `${item.originalIndex}-req`;
            const resKey = `${item.originalIndex}-res`;
            const isReqExpanded = expandedPayloads[reqKey] ?? false;
            const isResExpanded = expandedPayloads[resKey] ?? false;

            return (
              <div key={item.originalIndex} className="relative group">
                {/* Timeline Node Dot */}
                <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border flex items-center justify-center ${badgeBg} bg-surface`}>
                  <Icon className="w-2.5 h-2.5" />
                </div>

                {/* Breadcrumb Content Card */}
                <div className="bg-surface border border-border rounded-lg p-3 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="uppercase font-semibold tracking-wider text-zinc-400">
                        Step {item.originalIndex + 1}: {item.type}
                      </span>
                      {deltaMs !== null && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700" title="Elapsed time since previous step">
                          {formatDelta(deltaMs)}
                        </span>
                      )}
                    </div>
                    {item.timestamp && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </span>
                    )}
                  </div>

                  {/* Click Event */}
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

                  {/* Network Event */}
                  {isNetwork && (
                    <div className="text-xs">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-mono font-bold text-zinc-300">{item.method || 'GET'}</span>
                        <span className="font-mono text-zinc-400 truncate max-w-xs">{item.url}</span>
                        <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
                          (item.status >= 400 || item.status === 0)
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {item.status || 'TIMEOUT / 0'}
                        </span>
                        {item.durationMs !== undefined && (
                          <span className="text-[10px] text-zinc-500 font-mono">{item.durationMs}ms</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyCurl(item, item.originalIndex)}
                          className="ml-auto flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-elevated hover:bg-zinc-700 text-zinc-400 hover:text-white border border-border text-[10px] font-mono transition-colors"
                          title="Copy reproduction cURL command"
                        >
                          {copiedCurlIndex === item.originalIndex ? (
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

                      {/* Request Payload Collapsible */}
                      {item.requestBody && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => togglePayloadExpand(item.originalIndex, 'req')}
                            className="flex items-center space-x-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 font-semibold uppercase"
                          >
                            {isReqExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span>Request Payload ({typeof item.requestBody === 'object' ? Object.keys(item.requestBody).length : 'raw'} keys)</span>
                          </button>
                          {isReqExpanded && (
                            <pre className="mt-1 text-[11px] font-mono bg-background p-2 rounded border border-border text-zinc-300 overflow-x-auto select-all max-h-48">
                              {typeof item.requestBody === 'object' ? JSON.stringify(item.requestBody, null, 2) : String(item.requestBody)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Response Payload Collapsible */}
                      {item.responseBody && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => togglePayloadExpand(item.originalIndex, 'res')}
                            className="flex items-center space-x-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 font-semibold uppercase"
                          >
                            {isResExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span className={(item.status >= 400 || item.status === 0) ? 'text-red-400' : 'text-emerald-400'}>
                              {(item.status >= 400 || item.status === 0) ? 'Error Response Body' : 'Response Body'}
                            </span>
                          </button>
                          {isResExpanded && (
                            <pre className={`mt-1 text-[11px] font-mono bg-background p-2 rounded border border-border overflow-x-auto select-all max-h-48 ${
                              (item.status >= 400 || item.status === 0) ? 'text-red-300' : 'text-emerald-300'
                            }`}>
                              {typeof item.responseBody === 'object' ? JSON.stringify(item.responseBody, null, 2) : String(item.responseBody)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Console Event */}
                  {isConsole && (
                    <div className="text-xs font-mono text-zinc-300">
                      <span className={`font-semibold ${item.level === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                        [{item.level}]:
                      </span>{' '}
                      {item.message}
                    </div>
                  )}

                  {/* Navigation Event */}
                  {isNav && (
                    <div className="text-xs font-mono text-purple-300 flex items-center space-x-1.5">
                      <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-zinc-400">Navigated to:</span>
                      <span className="text-white font-semibold truncate">{item.url || item.to || 'Route'}</span>
                    </div>
                  )}

                  {/* User Report Event */}
                  {isReport && (
                    <div className="text-xs text-zinc-200 bg-blue-500/10 border border-blue-500/20 p-2 rounded">
                      <span className="font-semibold text-blue-400">User Report Note:</span> {item.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Culprit Crash Terminal Step */}
      {errorDetails && (
        <div className="relative group pl-6 pt-1">
          <div className="absolute left-2 top-2 w-4 h-4 rounded-full border border-red-500/40 bg-red-500/20 text-red-400 flex items-center justify-center -translate-x-1/2">
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
