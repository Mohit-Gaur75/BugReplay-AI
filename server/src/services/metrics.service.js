import { getDb } from '../db/db.js';
import { geminiCircuitBreaker } from './circuitBreaker.js';

/**
 * Production Metrics Registry & Prometheus Exporter
 * Formats system telemetry into standard OpenMetrics / Prometheus text format.
 */
class MetricsService {
  constructor() {
    this.httpRequests = new Map(); // key -> count
    this.httpDurations = new Map(); // key -> { sum, count }
    this.incidentsIngested = 0;
    this.incidentsDeduplicated = 0;
    this.synthesisJobs = {
      COMPLETED: 0,
      FAILED: 0,
      AI_GENERATED: 0,
      HEURISTIC_GENERATED: 0,
    };
    this.activeSseClients = 0;
  }

  recordHttpRequest(method, route, status, durationMs) {
    const key = `method="${method}",route="${route}",status="${status}"`;
    this.httpRequests.set(key, (this.httpRequests.get(key) || 0) + 1);

    const durKey = `method="${method}",route="${route}"`;
    const current = this.httpDurations.get(durKey) || { sum: 0, count: 0 };
    current.sum += durationMs;
    current.count += 1;
    this.httpDurations.set(durKey, current);
  }

  recordIncidentIngested(isDuplicate = false) {
    this.incidentsIngested += 1;
    if (isDuplicate) {
      this.incidentsDeduplicated += 1;
    }
  }

  recordSynthesis(status, engine) {
    if (this.synthesisJobs[status] !== undefined) {
      this.synthesisJobs[status] += 1;
    }
    if (engine === 'gemini') {
      this.synthesisJobs.AI_GENERATED += 1;
    } else {
      this.synthesisJobs.HEURISTIC_GENERATED += 1;
    }
  }

  setSseClients(count) {
    this.activeSseClients = count;
  }

  getPrometheusMetrics() {
    const lines = [];
    const now = Date.now();

    // 1. Process & Memory Metrics
    const mem = process.memoryUsage();
    lines.push('# HELP process_uptime_seconds Total process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds counter');
    lines.push(`process_uptime_seconds ${process.uptime()}`);

    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);

    lines.push('# HELP process_heap_used_bytes Process heap memory used.');
    lines.push('# TYPE process_heap_used_bytes gauge');
    lines.push(`process_heap_used_bytes ${mem.heapUsed}`);

    // 2. HTTP Request Counters
    lines.push('# HELP http_requests_total Total HTTP requests handled.');
    lines.push('# TYPE http_requests_total counter');
    for (const [labels, count] of this.httpRequests.entries()) {
      lines.push(`http_requests_total{${labels}} ${count}`);
    }

    // 3. HTTP Request Latency
    lines.push('# HELP http_request_duration_ms_total Total latency spent in HTTP requests.');
    lines.push('# TYPE http_request_duration_ms_total counter');
    for (const [labels, data] of this.httpDurations.entries()) {
      lines.push(`http_request_duration_ms_sum{${labels}} ${data.sum.toFixed(2)}`);
      lines.push(`http_request_duration_ms_count{${labels}} ${data.count}`);
    }

    // 4. Incident Telemetry Counters
    lines.push('# HELP bugreplay_incidents_ingested_total Total incidents ingested.');
    lines.push('# TYPE bugreplay_incidents_ingested_total counter');
    lines.push(`bugreplay_incidents_ingested_total{type="new"} ${this.incidentsIngested - this.incidentsDeduplicated}`);
    lines.push(`bugreplay_incidents_ingested_total{type="deduplicated"} ${this.incidentsDeduplicated}`);

    // 5. Synthesis Counters
    lines.push('# HELP bugreplay_synthesis_jobs_total Synthesis background jobs status count.');
    lines.push('# TYPE bugreplay_synthesis_jobs_total counter');
    lines.push(`bugreplay_synthesis_jobs_total{status="completed"} ${this.synthesisJobs.COMPLETED}`);
    lines.push(`bugreplay_synthesis_jobs_total{status="failed"} ${this.synthesisJobs.FAILED}`);
    lines.push(`bugreplay_synthesis_jobs_total{engine="gemini"} ${this.synthesisJobs.AI_GENERATED}`);
    lines.push(`bugreplay_synthesis_jobs_total{engine="heuristic"} ${this.synthesisJobs.HEURISTIC_GENERATED}`);

    // 6. Real-time SSE Connections
    lines.push('# HELP bugreplay_active_sse_connections Current active real-time SSE stream listeners.');
    lines.push('# TYPE bugreplay_active_sse_connections gauge');
    lines.push(`bugreplay_active_sse_connections ${this.activeSseClients}`);

    // 7. Circuit Breaker State
    const cb = geminiCircuitBreaker.getStatus();
    lines.push('# HELP bugreplay_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN).');
    lines.push('# TYPE bugreplay_circuit_breaker_state gauge');
    const stateVal = cb.state === 'CLOSED' ? 0 : cb.state === 'OPEN' ? 1 : 2;
    lines.push(`bugreplay_circuit_breaker_state{name="GeminiSynthesis",state="${cb.state}"} ${stateVal}`);

    // 8. Queue Depth from SQLite
    try {
      const db = getDb();
      const queueRow = db.prepare("SELECT COUNT(*) as depth FROM jobs WHERE status = 'PENDING'").get();
      const depth = queueRow ? queueRow.depth : 0;
      lines.push('# HELP bugreplay_jobs_queue_depth Pending synthesis jobs in queue.');
      lines.push('# TYPE bugreplay_jobs_queue_depth gauge');
      lines.push(`bugreplay_jobs_queue_depth ${depth}`);
    } catch (e) {}

    return lines.join('\n') + '\n';
  }
}

export const metrics = new MetricsService();
