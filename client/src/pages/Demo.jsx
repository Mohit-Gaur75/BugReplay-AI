import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  PlayCircle, 
  ShoppingCart, 
  ServerCrash, 
  AlertOctagon, 
  ArrowRight, 
  CheckCircle2, 
  Terminal, 
  Eye, 
  RefreshCw,
  Sparkles,
  Bug
} from 'lucide-react';

export default function Demo({ onOpenIncident, onGoToDashboard }) {
  const [demoApiKey, setDemoApiKey] = useState('');
  const [projectList, setProjectList] = useState([]);
  const [bufferItems, setBufferItems] = useState([]);
  const [lastIncident, setLastIncident] = useState(null);
  const [triggering, setTriggering] = useState(null);

  // Initialize SDK with a real project API key
  useEffect(() => {
    async function loadProjectsAndInit() {
      try {
        const res = await api.get('/projects');
        const list = res.data?.projects || [];
        setProjectList(list);

        if (list.length > 0) {
          // If a project exists, we can use its key prefix or create one
          setDemoApiKey(list[0].id);
        }

        // Check if BugReplay is on window
        if (typeof window !== 'undefined' && window.BugReplay) {
          // Poll buffer items for real-time visualizer
          const interval = setInterval(() => {
            if (window.BugReplay.buffer) {
              setBufferItems([...window.BugReplay.buffer.getItems()]);
            }
          }, 800);
          return () => clearInterval(interval);
        }
      } catch (err) {
        console.warn('Demo init error:', err);
      }
    }

    loadProjectsAndInit();
  }, []);

  // Scenario 1: Broken Checkout
  const handleBrokenCheckout = async () => {
    setTriggering('checkout');
    try {
      // 1. Simulate button click
      if (window.BugReplay?.buffer) {
        window.BugReplay.buffer.push({
          type: 'click',
          tagName: 'BUTTON',
          id: 'btn-submit-order',
          selector: 'button#btn-submit-order',
          innerText: 'Place Order ($89.00)',
          coordinates: { x: 340, y: 520 },
        });
      }

      // 2. Real network request that returns 504 Gateway Timeout
      const netRes = await fetch('/api/v1/simulate/checkout-timeout', { method: 'POST' });
      const errorJson = await netRes.json();

      // 3. Trigger Unhandled TypeError
      setTimeout(() => {
        setTriggering(null);
        setLastIncident({
          message: "Cannot read properties of undefined (reading 'transactionId')",
          type: 'TypeError',
          pageUrl: window.location.href,
        });

        // Capture through SDK
        if (window.BugReplay) {
          window.BugReplay.captureIncident({
            errorMessage: "Cannot read properties of undefined (reading 'transactionId')",
            errorType: 'TypeError',
            errorStack: "TypeError: Cannot read properties of undefined (reading 'transactionId')\n    at handleCheckoutResponse (checkout.js:84:22)\n    at async onSubmit (checkout.js:112:9)",
          });
        }
      }, 500);
    } catch (e) {
      setTriggering(null);
    }
  };

  // Scenario 2: Failed 500 API Call
  const handleServerCrash = async () => {
    setTriggering('500');
    try {
      if (window.BugReplay?.buffer) {
        window.BugReplay.buffer.push({
          type: 'click',
          tagName: 'BUTTON',
          id: 'btn-sync-inventory',
          selector: 'button#btn-sync-inventory',
          innerText: 'Sync Cart State',
          coordinates: { x: 420, y: 310 },
        });
      }

      const netRes = await fetch('/api/v1/simulate/server-error', { method: 'POST' });
      const errorJson = await netRes.json();

      setTimeout(() => {
        setTriggering(null);
        setLastIncident({
          message: `Network Request Failed: Server responded with status 500 (${errorJson.code})`,
          type: 'NetworkError',
          pageUrl: window.location.href,
        });

        if (window.BugReplay) {
          window.BugReplay.captureIncident({
            errorMessage: `Network Request Failed: Server responded with status 500 (${errorJson.code})`,
            errorType: 'NetworkError',
            errorStack: "NetworkError: Request to /api/v1/simulate/server-error failed with HTTP 500\n    at syncInventory (cart.js:14)",
          });
        }
      }, 500);
    } catch (e) {
      setTriggering(null);
    }
  };

  // Scenario 3: Undefined State Crash
  const handleUndefinedStateCrash = () => {
    setTriggering('state');
    if (window.BugReplay?.buffer) {
      window.BugReplay.buffer.push({
        type: 'click',
        tagName: 'A',
        id: 'user-profile-tab',
        selector: 'a#user-profile-tab',
        innerText: 'View Account Details',
        coordinates: { x: 180, y: 95 },
      });
    }

    setTimeout(() => {
      setTriggering(null);
      setLastIncident({
        message: "Cannot read properties of null (reading 'subscriptionTier')",
        type: 'TypeError',
        pageUrl: window.location.href,
      });

      if (window.BugReplay) {
        window.BugReplay.captureIncident({
          errorMessage: "Cannot read properties of null (reading 'subscriptionTier')",
          errorType: 'TypeError',
          errorStack: "TypeError: Cannot read properties of null (reading 'subscriptionTier')\n    at renderUserProfile (userProfile.jsx:32:15)\n    at Object.render (react-dom.js:140)",
        });
      }
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-2">
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Interactive Testbed Sandbox</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Test BugReplay AI Live</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Click any scenario below to trigger real-world errors. Watch the in-browser circular buffer capture your actions, transmit telemetry, and synthesize a Playwright test!
        </p>
      </div>

      {/* Incident Captured Notification Banner */}
      {lastIncident && (
        <div className="p-4 bg-gradient-to-r from-blue-950/40 via-surface to-purple-950/30 border border-blue-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <span>Incident Ingested & Playwright Synthesis Queued!</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  {lastIncident.type}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                {lastIncident.message}
              </p>
            </div>
          </div>

          <button
            onClick={onGoToDashboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow shrink-0"
          >
            <span>View in Incident Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Interactive Bug Trigger Scenarios */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Scenario 1: Broken Checkout */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Broken Checkout</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Simulates a payment gateway timeout (HTTP 504), causing an unhandled TypeError during cart state reconciliation.
            </p>
            <div className="text-[11px] font-mono text-zinc-500 bg-background p-2 rounded border border-border">
              POST /api/v1/simulate/checkout-timeout -&gt; 504
            </div>
          </div>

          <button
            disabled={triggering !== null}
            onClick={handleBrokenCheckout}
            className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
          >
            {triggering === 'checkout' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
            <span>Trigger Broken Checkout</span>
          </button>
        </div>

        {/* Scenario 2: 500 API Call */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center mb-4">
              <ServerCrash className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">500 Server Failure</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Simulates an unhandled internal server error (HTTP 500) during cart inventory synchronization.
            </p>
            <div className="text-[11px] font-mono text-zinc-500 bg-background p-2 rounded border border-border">
              POST /api/v1/simulate/server-error -&gt; 500
            </div>
          </div>

          <button
            disabled={triggering !== null}
            onClick={handleServerCrash}
            className="w-full py-2.5 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
          >
            {triggering === '500' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
            <span>Trigger 500 API Call</span>
          </button>
        </div>

        {/* Scenario 3: Undefined State Crash */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Null State Crash</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Simulates a classic frontend React TypeError when accessing nested properties on an uninitialized state object.
            </p>
            <div className="text-[11px] font-mono text-zinc-500 bg-background p-2 rounded border border-border">
              TypeError: Cannot read properties of null
            </div>
          </div>

          <button
            disabled={triggering !== null}
            onClick={handleUndefinedStateCrash}
            className="w-full py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
          >
            {triggering === 'state' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
            <span>Trigger Undefined State</span>
          </button>
        </div>
      </div>

      {/* Live Ring Buffer Telemetry Inspector */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Live In-Memory Ring Buffer Inspector</h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Capacity: 15 events (O(1) memory bound)
          </span>
        </div>

        {bufferItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-border rounded-lg">
            Buffer is listening for clicks and network requests... Click any button above to see events populate here!
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {bufferItems.map((evt, idx) => (
              <div key={idx} className="p-2.5 bg-background border border-border rounded text-xs font-mono flex items-center justify-between text-zinc-300">
                <div className="flex items-center space-x-2 truncate mr-2">
                  <span className="text-blue-400 font-bold">[{evt.type}]</span>
                  <span className="truncate">{evt.innerText || evt.url || evt.message || evt.tagName}</span>
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
