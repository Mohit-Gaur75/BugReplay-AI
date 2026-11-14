import { metrics } from '../../services/metrics.service.js';

/**
 * Real-Time Server-Sent Events (SSE) Service
 * Pushes instant incident alerts and synthesis updates to connected browser clients.
 */
class SseService {
  constructor() {
    // Map: userId -> Set of express res objects
    this.clients = new Map();
  }

  addClient(userId, res) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }

    const userClients = this.clients.get(userId);
    userClients.add(res);

    this.updateMetric();

    // Send initial connected handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now(), message: 'BugReplay real-time stream established' })}\n\n`);

    // Setup heartbeat interval (25s) to prevent proxy dropouts
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
      } catch (e) {
        clearInterval(heartbeat);
      }
    }, 25000);

    // Clean up on disconnect
    res.on('close', () => {
      clearInterval(heartbeat);
      userClients.delete(res);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
      this.updateMetric();
    });
  }

  updateMetric() {
    let total = 0;
    for (const set of this.clients.values()) {
      total += set.size;
    }
    metrics.setSseClients(total);
  }

  broadcastToUser(userId, eventName, payload) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) return;

    const dataString = JSON.stringify(payload);
    for (const res of userClients) {
      try {
        res.write(`event: ${eventName}\ndata: ${dataString}\n\n`);
      } catch (err) {
        userClients.delete(res);
      }
    }
    this.updateMetric();
  }

  broadcastToAll(eventName, payload) {
    for (const userId of this.clients.keys()) {
      this.broadcastToUser(userId, eventName, payload);
    }
  }
}

export const sseService = new SseService();
