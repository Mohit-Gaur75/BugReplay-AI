/**
 * Production Circuit Breaker
 * State Machine: CLOSED (normal) -> OPEN (tripped, fail-fast) -> HALF_OPEN (probe)
 * Protects system latency and worker threads during external API degradation.
 */
export class CircuitBreaker {
  constructor(name = 'GeminiApi', options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs || 30000; // 30s
    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChange = Date.now();
    this.totalTrips = 0;
  }

  isOpen() {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastStateChange >= this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = now;
        console.log(`[CircuitBreaker:${this.name}] Transitioned to HALF_OPEN (probing external service)...`);
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
      console.log(`[CircuitBreaker:${this.name}] External service probe succeeded. Resetting to CLOSED.`);
    }
  }

  recordFailure(err) {
    this.failureCount += 1;
    console.warn(`[CircuitBreaker:${this.name}] Failure recorded (${this.failureCount}/${this.failureThreshold}): ${err?.message || 'Unknown error'}`);

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      this.totalTrips += 1;
      console.error(`🚨 [CircuitBreaker:${this.name}] TRIPPED TO OPEN! External requests will fail-fast to deterministic heuristic for ${this.recoveryTimeoutMs / 1000}s.`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      totalTrips: this.totalTrips,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastStateChange = Date.now();
  }
}

// Global Singleton for AI Synthesis
export const geminiCircuitBreaker = new CircuitBreaker('GeminiSynthesis', {
  failureThreshold: 3,
  recoveryTimeoutMs: 30000,
});
