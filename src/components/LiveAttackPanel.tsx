import { useState, useEffect, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────

const WS_URL = "ws://localhost:3001/ws";

export type ServerStatus = "ONLINE" | "DEGRADED" | "CRITICAL" | "DOWN";

export interface ServerMetrics {
  totalRequests:    number;
  activeRequests:   number;
  requestsLastSec:  number;
  totalErrors:      number;
  avgLatencyMs:     number;
  p99LatencyMs:     number;
  maxLatencyMs:     number;
  serverStatus:     ServerStatus;
  uptime:           number;
  endpointCounts:   Record<string, number>;
}

const STATUS_COLORS: Record<ServerStatus, string> = {
  ONLINE:   "#39ff14",
  DEGRADED: "#fff200",
  CRITICAL: "#ff8c00",
  DOWN:     "#ff073a",
};

interface Props {
  onMetrics: (m: ServerMetrics | null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveAttackPanel({ onMetrics }: Props) {
  const [connected, setConnected] = useState(false);
  const [metrics,   setMetrics]   = useState<ServerMetrics | null>(null);
  const [rpsHistory, setRpsHistory] = useState<{ t: number; rps: number; latency: number }[]>([]);

  // WebSocket with auto-reconnect
  useEffect(() => {
    let ws: WebSocket;
    let dead = false;
    let tick = 0;

    function connect() {
      if (dead) return;
      ws = new WebSocket(WS_URL);
      ws.onopen  = () => setConnected(true);
      ws.onclose = () => { setConnected(false); onMetrics(null); setTimeout(connect, 3000); };
      ws.onerror = () => setConnected(false);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "metrics" || msg.type === "hello") {
          const m = msg.data as ServerMetrics;
          setMetrics(m);
          onMetrics(m);
          tick++;
          setRpsHistory(prev => [
            ...prev,
            { t: tick, rps: m.requestsLastSec, latency: m.avgLatencyMs },
          ].slice(-60));
        }
      };
    }

    connect();
    return () => { dead = true; ws?.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Chart
  const chartData = useMemo(() => ({
    labels: rpsHistory.map(p => `${p.t}`),
    datasets: [
      {
        label: "Req/s",
        data: rpsHistory.map(p => p.rps),
        borderColor: "#00d9ff",
        backgroundColor: "#00d9ff18",
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y",
      },
      {
        label: "Avg Latency (ms)",
        data: rpsHistory.map(p => Math.min(p.latency, 10000)),
        borderColor: "#ff073a",
        borderDash: [4, 3],
        borderWidth: 1.5,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y1",
      },
    ],
  }), [rpsHistory]);

  const chartOpts = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 150 },
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      x: { display: false },
      y:  { position: "left" as const,  beginAtZero: true, ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.04)" }, title: { display: true, text: "req/s", color: "#64748b", font: { size: 9 } } },
      y1: { position: "right" as const, beginAtZero: true, ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { drawOnChartArea: false }, title: { display: true, text: "ms", color: "#64748b", font: { size: 9 } } },
    },
    plugins: {
      legend: { display: true, position: "bottom" as const, labels: { color: "#64748b", font: { size: 10 }, boxWidth: 10 } },
    },
  }), []);

  const statusColor = metrics ? STATUS_COLORS[metrics.serverStatus] : "#cbd5e1";
  const statusTextColor = metrics?.serverStatus === "ONLINE" ? "#1a7a00" :
                          metrics?.serverStatus === "DEGRADED" ? "#9a7b00" :
                          metrics?.serverStatus === "CRITICAL" ? "#c25600" : "#c2002e";

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            connected
              ? "border-[#39ff14]/40 bg-[#39ff14]/10"
              : "border-slate-300 bg-slate-100"
          }`}
          style={{ color: connected ? "#1a7a00" : "#94a3b8" }}
        >
          <span
            className={`h-2 w-2 rounded-full ${connected ? "animate-pulse" : ""}`}
            style={{ background: connected ? "#39ff14" : "#cbd5e1", boxShadow: connected ? "0 0 6px #39ff14" : "none" }}
          />
          {connected ? "WebSocket connected · Live metrics" : "Server offline — run: npm run server"}
        </div>

        {metrics && (
          <div
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{
              background: `${statusColor}15`,
              color: statusTextColor,
              borderColor: `${statusColor}55`,
            }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            {metrics.serverStatus}
          </div>
        )}

      </div>

      {metrics ? (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricBox label="Req/sec" value={metrics.requestsLastSec.toString()} textColor="#0099b8" />
            <MetricBox label="Concurrent" value={metrics.activeRequests.toString()} textColor={statusTextColor} />
            <MetricBox label="Avg Latency" value={`${metrics.avgLatencyMs.toFixed(1)} ms`} textColor="#c2002e" />
            <MetricBox label="p99 Latency" value={`${metrics.p99LatencyMs.toFixed(0)} ms`} textColor="#c25600" />
            <MetricBox label="Total Served" value={metrics.totalRequests.toLocaleString()} textColor="#475569" />
            <MetricBox label="Uptime" value={`${metrics.uptime}s`} textColor="#475569" />
          </div>

          {/* Active connections bar */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="text-slate-500">Active concurrent requests</span>
              <span className="font-mono font-bold" style={{ color: statusTextColor }}>
                {metrics.activeRequests} / 100
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (metrics.activeRequests / 100) * 100)}%`,
                  background: statusColor,
                  boxShadow: `0 0 6px ${statusColor}88`,
                }}
              />
            </div>
          </div>

          {/* Endpoint breakdown */}
          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
            {[
              { label: "/flood",   key: "flood",   color: "#ff073a" },
              { label: "/health",  key: "health",  color: "#fff200" },
              { label: "/data",    key: "data",    color: "#a855f7" },
              { label: "/compute", key: "compute", color: "#00d9ff" },
            ].map(e => (
              <div key={e.key} className="rounded border border-slate-200 bg-slate-50 py-1.5 px-1">
                <div className="text-slate-500">{e.label}</div>
                <div className="font-mono font-semibold" style={{ color: e.color }}>
                  {(metrics.endpointCounts?.[e.key] ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">
              Request Rate & Latency
            </div>
            <div style={{ height: 140 }}>
              <Line data={chartData} options={chartOpts} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center">
          <div className="text-3xl">🖥️</div>
          <div className="text-sm text-slate-500">Server not running</div>
          <code className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono" style={{ color: "#0099b8" }}>
            npm run server
          </code>
          <div className="text-[11px] text-slate-400">then run the Python attack script in a separate terminal</div>
        </div>
      )}


    </div>
  );
}

function MetricBox({ label, value, textColor }: { label: string; value: string; textColor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono font-bold" style={{ color: textColor }}>
        {value}
      </div>
    </div>
  );
}
