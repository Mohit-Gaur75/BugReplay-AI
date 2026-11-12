import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  ShoppingBag, 
  CreditCard, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  CheckCircle2, 
  ArrowRight,
  Send
} from 'lucide-react';

export default function DemoSandbox() {
  const [cartItems, setCartItems] = useState([]);
  const [bufferEvents, setBufferEvents] = useState([]);
  const [lastDispatchedIncident, setLastDispatchedIncident] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll local SDK ring buffer to display live buffer updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.BugReplay && typeof window.BugReplay.getBuffer === 'function') {
        const events = window.BugReplay.getBuffer();
        setBufferEvents(events || []);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // 1. Normal user action: Add item to cart
  const handleAddItem = (name, price) => {
    setCartItems((prev) => [...prev, { id: Date.now(), name, price }]);
  };

  // 2. Trigger Broken Checkout (TypeError)
  const handleBrokenCheckout = () => {
    try {
      // Simulate real-world component state bug: accessing property on undefined object
      const orderPayload = undefined;
      // Intentionally uncaught exception
      const discount = orderPayload.discountCode;
    } catch (err) {
      setErrorToast(`Uncaught TypeError: ${err.message}`);
      // Throw globally so window.onerror catches it
      setTimeout(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'discountCode')");
      }, 10);
    }
  };

  // 3. Trigger 500 Payment Gateway API Call
  const handleTrigger500 = async () => {
    setIsSubmitting(true);
    setErrorToast(null);
    try {
      // Trigger a real mock network call through fetch
      const res = await fetch('/api/v1/mock/payment-timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 49.99,
          currency: 'USD',
          card: '••••-••••-••••-4242' // PII masked
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP 500: Downstream payment processor timed out after 3000ms`);
      }
    } catch (networkError) {
      setErrorToast(networkError.message);
      // Trigger unhandled rejection
      Promise.reject(networkError);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Trigger Undefined State Crash
  const handleUndefinedStateCrash = () => {
    setTimeout(() => {
      throw new ReferenceError("userProfile is not defined at CheckoutScreen.render");
    }, 10);
  };

  // 5. Manual Issue Reporting
  const handleManualReport = () => {
    if (window.BugReplay) {
      window.BugReplay.reportIssue('User clicked Report Issue in Demo Sandbox: Checkout button was unresponsive');
      setErrorToast('Manual issue report captured and transmitted with session ring buffer.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="border-b border-dark-800 pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-semibold uppercase">
              Interactive Testbed
            </span>
            <span className="flex items-center space-x-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SDK Flight Recorder Active</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            BugReplay Live Sandbox
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Test the 3KB SDK in real time. Click buttons to trigger genuine frontend crashes and network 500s.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-200 hover:text-white border border-dark-700 text-sm font-medium transition-colors"
        >
          <span>View Dashboard Incidents</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Error alert toast if triggered */}
      {errorToast && (
        <div
          data-testid="error-alert"
          role="alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start justify-between shadow-lg animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-sm text-rose-200">Crash Intercepted by BugReplay SDK</div>
              <div className="text-xs font-mono text-rose-300 mt-0.5">{errorToast}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Telemetry beacon dispatched to <code className="text-brand-300">/api/v1/ingest</code>. Check the Dashboard to inspect the synthesized Playwright test!
              </div>
            </div>
          </div>

          <Link
            to="/dashboard"
            className="flex items-center space-x-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <span>View in Feed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Two Columns: Interactive Storefront vs Live Ring Buffer Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Simulated Storefront (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-dark-900 border border-dark-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-dark-800 pb-4">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-brand-400" />
                <h2 className="text-base font-bold text-white">Acme Storefront Simulation</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Cart Items: <strong className="text-brand-400">{cartItems.length}</strong>
              </span>
            </div>

            {/* Product Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-dark-850 border border-dark-800 space-y-3">
                <div className="text-sm font-semibold text-white">Pro Mechanical Keyboard</div>
                <div className="text-xs text-slate-400">Custom linear switches with aluminum frame.</div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-sm text-brand-400 font-bold">$129.00</span>
                  <button
                    id="btn-add-keyboard"
                    data-testid="add-keyboard"
                    onClick={() => handleAddItem('Pro Mechanical Keyboard', 129.00)}
                    className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-200 text-xs font-medium border border-dark-700 transition-colors"
                  >
                    + Add to Cart
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-dark-850 border border-dark-800 space-y-3">
                <div className="text-sm font-semibold text-white">Studio Monitor Headphones</div>
                <div className="text-xs text-slate-400">Neutral frequency response for mixing.</div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-sm text-brand-400 font-bold">$179.00</span>
                  <button
                    id="btn-add-headphones"
                    data-testid="add-headphones"
                    onClick={() => handleAddItem('Studio Monitor Headphones', 179.00)}
                    className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-200 text-xs font-medium border border-dark-700 transition-colors"
                  >
                    + Add to Cart
                  </button>
                </div>
              </div>
            </div>

            {/* PII Masking Demonstration Form */}
            <div className="p-4 rounded-xl bg-dark-950/80 border border-dark-800 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Leak PII Masking Tester</span>
              </div>
              <p className="text-xs text-slate-400">
                Type into these sensitive fields. The BugReplay SDK automatically scrubs them into <code className="text-emerald-300 font-mono">[REDACTED_PII]</code> before entering the ring buffer.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">Credit Card Number</label>
                  <input
                    type="text"
                    name="card_number"
                    id="input-card-number"
                    placeholder="4532 •••• •••• 8892"
                    className="w-full px-3 py-1.5 rounded bg-dark-900 border border-dark-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">CVV / Security Code</label>
                  <input
                    type="password"
                    name="cvv"
                    id="input-cvv"
                    placeholder="•••"
                    className="w-full px-3 py-1.5 rounded bg-dark-900 border border-dark-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Simulated Crash Trigger Buttons */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Trigger Real-World Bug Scenarios
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="btn-broken-checkout"
                  data-testid="btn-broken-checkout"
                  onClick={handleBrokenCheckout}
                  className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium text-xs transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>1. Trigger TypeError Crash</span>
                </button>

                <button
                  id="btn-trigger-500"
                  data-testid="btn-trigger-500"
                  onClick={handleTrigger500}
                  disabled={isSubmitting}
                  className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-medium text-xs transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-400 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>2. Trigger 500 Payment API Timeout</span>
                </button>

                <button
                  id="btn-undefined-crash"
                  data-testid="btn-undefined-crash"
                  onClick={handleUndefinedStateCrash}
                  className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium text-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>3. Trigger ReferenceError</span>
                </button>

                <button
                  id="btn-report-issue"
                  data-testid="btn-report-issue"
                  onClick={handleManualReport}
                  className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 font-medium text-xs transition-colors"
                >
                  <Send className="w-4 h-4 text-brand-400" />
                  <span>4. Send Manual Issue Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Circular Ring Buffer Telemetry Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-dark-900 border border-dark-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">In-Memory Ring Buffer</h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-dark-800 text-slate-300">
                {bufferEvents.length} / 15 Events
              </span>
            </div>

            <p className="text-xs text-slate-400">
              The circular array keeps the last 15 user actions in browser memory with $O(1)$ memory consumption.
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {bufferEvents.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-dark-800 rounded-lg">
                  Click around the sandbox or enter text to see events populate the ring buffer.
                </div>
              ) : (
                bufferEvents.slice().reverse().map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-dark-850 border border-dark-800 text-xs font-mono space-y-1 hover:border-dark-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-brand-400 uppercase text-[10px]">
                        {ev.type}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {ev.type === 'click' && (
                      <div className="text-slate-300 text-[11px]">
                        <div><span className="text-slate-500">Selector:</span> {ev.selector}</div>
                        {ev.innerText && <div><span className="text-slate-500">Text:</span> {ev.innerText}</div>}
                      </div>
                    )}

                    {ev.type === 'network' && (
                      <div className="text-slate-300 text-[11px]">
                        <div><span className="text-slate-500">Call:</span> {ev.method} {ev.url}</div>
                        <div>
                          <span className="text-slate-500">Status:</span>{' '}
                          <span className={ev.status >= 400 ? 'text-rose-400' : 'text-emerald-400'}>
                            {ev.status}
                          </span>{' '}
                          ({ev.durationMs}ms)
                        </div>
                      </div>
                    )}

                    {ev.type === 'console' && (
                      <div className="text-amber-300 text-[11px]">
                        <span className="text-slate-500">Log:</span> {ev.message}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
