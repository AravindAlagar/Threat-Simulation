/**
 * server/index.js — Intentionally Vulnerable Target Server
 * =========================================================
 * Educational DoS target.  Deliberately omits every security mechanism
 * so students can observe real degradation under load.
 *
 * MISSING BY DESIGN:
 *   ✗ Rate limiting        ✗ Input validation
 *   ✗ Authentication       ✗ CORS restrictions
 *   ✗ Payload size cap     ✗ IP blocking
 *   ✗ Request timeouts
 */

import express  from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http      from 'http';
import cors      from 'cors';

const PORT = process.env.PORT || 3001;

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws' });

// ─── No Security — Intentional ────────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Metrics State ────────────────────────────────────────────────────────────

const state = {
  totalRequests:    0,
  activeRequests:   0,
  requestsThisSec:  0,
  requestsLastSec:  0,
  totalErrors:      0,
  avgLatencyMs:     0,
  p99LatencyMs:     0,
  maxLatencyMs:     0,
  serverStatus:     'ONLINE',
  uptime:           0,
  startTime:        Date.now(),
  endpointCounts:   { health: 0, data: 0, compute: 0, flood: 0 },
};

const latencyWindow = [];

function updateLatency(ms) {
  latencyWindow.push(ms);
  if (latencyWindow.length > 500) latencyWindow.shift();

  const sum = latencyWindow.reduce((a, b) => a + b, 0);
  state.avgLatencyMs = sum / latencyWindow.length;
  state.maxLatencyMs = Math.max(state.maxLatencyMs, ms);

  const sorted = [...latencyWindow].sort((a, b) => a - b);
  state.p99LatencyMs = sorted[Math.floor(sorted.length * 0.99)] ?? ms;

  const a = state.activeRequests;
  const avg = state.avgLatencyMs;
  if      (a > 100 || avg > 5000) state.serverStatus = 'DOWN';
  else if (a > 50  || avg > 800)  state.serverStatus = 'CRITICAL';
  else if (a > 20  || avg > 150)  state.serverStatus = 'DEGRADED';
  else                             state.serverStatus = 'ONLINE';
}

// ─── Per-second Ticker — broadcasts to all WebSocket clients ─────────────────

setInterval(() => {
  state.requestsLastSec = state.requestsThisSec;
  state.requestsThisSec = 0;
  state.uptime = Math.floor((Date.now() - state.startTime) / 1000);

  const payload = JSON.stringify({ type: 'metrics', data: { ...state } });
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}, 1000);

// ─── Realistic Load Degradation ──────────────────────────────────────────────

function simulateWork(baseMs) {
  const loadFactor = 1 + Math.max(0, state.activeRequests - 5) * 0.12;
  const jitter     = Math.random() * 6;
  return new Promise(resolve => setTimeout(resolve, baseMs * loadFactor + jitter));
}

// ─── Request Tracking ─────────────────────────────────────────────────────────

function track(req, res, next) {
  state.totalRequests++;
  state.activeRequests++;
  state.requestsThisSec++;
  res.on('finish', () => { state.activeRequests = Math.max(0, state.activeRequests - 1); });
  next();
}

// ─── Endpoints (all unprotected) ──────────────────────────────────────────────

app.get('/api/health', track, async (_req, res) => {
  state.endpointCounts.health++;
  const t = Date.now();
  await simulateWork(15);
  const latency = Date.now() - t;
  updateLatency(latency);
  res.json({ status: state.serverStatus, latencyMs: latency, active: state.activeRequests, total: state.totalRequests });
});

app.post('/api/data', track, async (req, res) => {
  state.endpointCounts.data++;
  const t        = Date.now();
  const bodySize = JSON.stringify(req.body).length;
  await simulateWork(25);
  const latency = Date.now() - t;
  updateLatency(latency);
  res.json({ received: true, bodyBytes: bodySize, keys: typeof req.body === 'object' ? Object.keys(req.body ?? {}).length : 0, latencyMs: latency });
});

app.get('/api/compute', track, async (_req, res) => {
  state.endpointCounts.compute++;
  const t = Date.now();
  let x = 0;
  for (let i = 0; i < 500_000; i++) x += Math.sqrt(i);
  await simulateWork(30);
  const latency = Date.now() - t;
  updateLatency(latency);
  res.json({ result: x.toFixed(2), latencyMs: latency });
});

app.all('/api/flood', track, async (_req, res) => {
  state.endpointCounts.flood++;
  const t = Date.now();
  await simulateWork(8);
  const latency = Date.now() - t;
  updateLatency(latency);
  res.json({ ok: true, latencyMs: latency, queue: state.activeRequests });
});

app.get('/api/metrics', (_req, res) => {
  res.json({ ...state, recentLatencies: latencyWindow.slice(-30) });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', data: { ...state } }));
});

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║      DoS Target Server  ·  Educational Demo          ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  HTTP  →  http://localhost:${PORT}                   ║`);
  console.log(`  ║  WS    →  ws://localhost:${PORT}/ws                  ║`);
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  Endpoints:                                          ║');
  console.log('  ║    GET  /api/health   (~15ms)                       ║');
  console.log('  ║    POST /api/data     (~25ms · no validation)       ║');
  console.log('  ║    GET  /api/compute  (~50ms · CPU heavy)           ║');
  console.log('  ║    ALL  /api/flood    (~8ms  · lightweight)         ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  ✗ No rate limiting   ✗ No input validation         ║');
  console.log('  ║  ✗ No authentication  ✗ No CORS restriction         ║');
  console.log('  ║  ✗ No IP blocking     ✗ No request timeouts         ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});
