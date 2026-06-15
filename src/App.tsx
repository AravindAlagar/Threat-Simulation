import { useCallback, useMemo, useRef, useState } from "react";
import { Card } from "./components/Card";
import { RiskGauge } from "./components/RiskGauge";
import { PasswordAnalyzer } from "./components/PasswordAnalyzer";
import { LiveAttackPanel, ServerMetrics } from "./components/LiveAttackPanel";
import { NetworkGraph } from "./components/NetworkGraph";
import { ActivityLog } from "./components/ActivityLog";
import {
  ShieldIcon,
  TargetIcon,
  LockIcon,
  BoltIcon,
  NetworkIcon,
  ListIcon,
  VirusIcon,
  FirewallIcon,
  PlayIcon,
  RefreshIcon,
  HeartIcon,
  TrashIcon,
} from "./components/Icons";
import { PasswordAnalysis } from "./utils/password";
import {
  buildNetwork,
  clearAll,
  DEFAULT_NODE_COUNT,
  healAll,
  infectionPercent,
  infectPatientZero,
  NetworkState,
  spreadStep,
  toggleNodeInfected,
  toggleNodeProtected,
} from "./utils/network";
import { computeRisk } from "./utils/risk";
import { LogEntry, makeEntry, MAX_LOG, Severity } from "./utils/log";

type NodeClickMode = "infect" | "firewall";

// Electric palette tokens
const ELEC_BLUE = "#00d9ff";
const ELEC_GREEN = "#39ff14";
const ELEC_YELLOW = "#fff200";
const ELEC_RED = "#ff073a";

export default function App() {
  const [pwAnalysis, setPwAnalysis] = useState<PasswordAnalysis | null>(null);

  // ── Live server metrics from LiveAttackPanel ───────────────────────────
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics | null>(null);
  const lastServerStatus = useRef<string | null>(null);

  // ── Network state ──────────────────────────────────────────────────────
  const [nodeCountInput, setNodeCountInput] = useState<string>(String(DEFAULT_NODE_COUNT));
  const [network, setNetwork] = useState<NetworkState>(() => buildNetwork(DEFAULT_NODE_COUNT));
  const [thresholdInput, setThresholdInput] = useState<string>("0.5");
  const [clickMode, setClickMode] = useState<NodeClickMode>("infect");

  // ── Log ─────────────────────────────────────────────────────────────────
  const [log, setLog] = useState<LogEntry[]>([]);
  const pushLog = useCallback((severity: Severity, message: string) => {
    setLog(prev => [makeEntry(severity, message), ...prev].slice(0, MAX_LOG));
  }, []);

  // ── Server metrics callback — log state transitions ────────────────────
  const handleServerMetrics = useCallback((m: ServerMetrics | null) => {
    setServerMetrics(m);
    if (m && m.serverStatus !== lastServerStatus.current) {
      const sev: Severity =
        m.serverStatus === "DOWN" || m.serverStatus === "CRITICAL"
          ? "CRITICAL"
          : m.serverStatus === "DEGRADED"
          ? "WARNING"
          : "INFO";
      pushLog(sev, `Server → ${m.serverStatus} (${m.requestsLastSec} req/s, latency ${m.avgLatencyMs.toFixed(0)}ms, ${m.activeRequests} active)`);
      lastServerStatus.current = m.serverStatus;
    }
    if (!m && lastServerStatus.current !== null) {
      pushLog("WARNING", "Server disconnected");
      lastServerStatus.current = null;
    }
  }, [pushLog]);

  // ── Network interactions ────────────────────────────────────────────────
  const onNodeClick = (id: number) => {
    setNetwork(prev => {
      if (clickMode === "infect") {
        const node = prev.nodes.find(n => n.id === id);
        const next = toggleNodeInfected(prev, id);
        pushLog(
          node?.infected ? "INFO" : "CRITICAL",
          `Node N${id} ${node?.infected ? "healed" : "manually infected"}`
        );
        return next;
      } else {
        const node = prev.nodes.find(n => n.id === id);
        const next = toggleNodeProtected(prev, id);
        pushLog("INFO", `Node N${id} firewall ${node?.protected ? "removed" : "enabled"}`);
        return next;
      }
    });
  };

  const stepSpread = () => {
    const thr = Math.min(1, Math.max(0, parseFloat(thresholdInput) || 0.5));
    setNetwork(prev => {
      const result = spreadStep(prev, thr);
      if (result.newlyInfected.length === 0) {
        pushLog("INFO", `Spread step @ threshold ${thr.toFixed(2)} — no new infections.`);
      } else {
        const ids = result.newlyInfected.map(i => `N${i}`).join(", ");
        pushLog(
          result.newlyInfected.length > 2 ? "CRITICAL" : "WARNING",
          `Infection spread → ${ids} (threshold ${thr.toFixed(2)})`
        );
      }
      return result.state;
    });
  };

  const healAllNodes = () => { setNetwork(prev => healAll(prev)); pushLog("INFO", "All nodes healed."); };
  const clearAllNodes = () => { setNetwork(prev => clearAll(prev)); pushLog("INFO", "Network cleared."); };
  const infectRandom = () => {
    setNetwork(prev => {
      const { state: next, infectedId } = infectPatientZero(prev);
      if (infectedId < 0) {
        pushLog("WARNING", "No eligible node to infect.");
      } else {
        pushLog("CRITICAL", `Patient zero → Node N${infectedId}`);
      }
      return next;
    });
  };
  const rebuildNetwork = () => {
    const n = parseInt(nodeCountInput, 10);
    if (Number.isNaN(n) || n < 2 || n > 40) {
      pushLog("WARNING", "Node count must be between 2 and 40.");
      return;
    }
    setNetwork(buildNetwork(n));
    pushLog("INFO", `Network rebuilt with ${n} nodes.`);
  };

  // ── Risk computation (now using real server metrics) ────────────────────
  const infectionPct = useMemo(() => infectionPercent(network), [network]);
  const risk = useMemo(
    () =>
      computeRisk({
        passwordEntropy: pwAnalysis?.entropy ?? 0,
        passwordProvided: (pwAnalysis?.length ?? 0) > 0,
        ddosActive: serverMetrics !== null,
        serverStatus: serverMetrics?.serverStatus ?? "ONLINE",
        activeRequests: serverMetrics?.activeRequests ?? 0,
        avgLatencyMs: serverMetrics?.avgLatencyMs ?? 0,
        infectionPercent: infectionPct,
      }),
    [pwAnalysis, serverMetrics, infectionPct]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-900"
              style={{ background: ELEC_BLUE, boxShadow: `0 0 12px ${ELEC_BLUE}88` }}
            >
              <ShieldIcon size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                Cyber Threat Simulation Dashboard
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 md:text-sm">
                Real DoS attack via Python script · SIR infection model · GPU password cracking
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: `${ELEC_GREEN}80`, background: `${ELEC_GREEN}18`, color: "#1a7a00" }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: ELEC_GREEN, boxShadow: `0 0 6px ${ELEC_GREEN}` }} />
            <span className="font-mono uppercase tracking-wider">Live</span>
          </div>
        </header>

        {/* Risk panel */}
        <Card title="Unified Risk Assessment" icon={<TargetIcon size={16} />} className="mb-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
            <RiskGauge risk={risk} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <RiskBar
                label="Password Risk" weight="30%" value={risk.passwordRisk} active={risk.passwordActive}
                hint={risk.passwordActive ? `${pwAnalysis?.strength} · ${(pwAnalysis?.entropy ?? 0).toFixed(0)} bits` : "No password entered"}
              />
              <RiskBar
                label="DoS Risk" weight="40%" value={risk.ddosRisk} active={risk.ddosActive}
                hint={risk.ddosActive ? `${serverMetrics?.serverStatus} · ${serverMetrics?.requestsLastSec ?? 0} req/s` : "Server offline"}
              />
              <RiskBar
                label="Infection Risk" weight="30%" value={risk.infectionRisk} active={risk.infectionActive}
                hint={risk.infectionActive ? `${infectionPct.toFixed(0)}% of nodes infected` : "No infected nodes"}
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-3">
                <RiskFormula risk={risk} />
              </div>
            </div>
          </div>
        </Card>

        {/* Modules */}
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card title="Password Analyzer" icon={<LockIcon size={16} />}>
            <PasswordAnalyzer onChange={setPwAnalysis} />
          </Card>

          <Card title="DoS Attack — Live Server" icon={<BoltIcon size={16} />}>
            <LiveAttackPanel onMetrics={handleServerMetrics} />
          </Card>

          <Card title="Network Infection" icon={<NetworkIcon size={16} />}>
            <div className="space-y-3">
              <div className="h-64 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <NetworkGraph network={network} onNodeClick={onNodeClick} />
              </div>
              <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
                <Legend color={ELEC_GREEN} label="Healthy" />
                <Legend color={ELEC_RED} label="Infected" />
                <Legend color={ELEC_BLUE} label="Firewall" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Infected" value={`${network.nodes.filter(n => n.infected).length}/${network.nodes.length}`} color={ELEC_RED} />
                <Stat label="Protected" value={`${network.nodes.filter(n => n.protected).length}`} color={ELEC_BLUE} textOverride="#0099b8" />
                <Stat label="Spread" value={`${infectionPct.toFixed(0)}%`} color={ELEC_YELLOW} textOverride="#9a7b00" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton onClick={stepSpread} icon={<PlayIcon size={14} />} label="Step Spread" variant="neutral" title="Apply one spread step" />
                  <ActionButton onClick={infectRandom} icon={<VirusIcon size={14} />} label="Infect Random" variant="neutral" title="Infect patient zero" />
                  <ActionButton onClick={healAllNodes} icon={<HeartIcon size={14} />} label="Heal All" variant="neutral" title="Remove all infections" />
                  <ActionButton onClick={clearAllNodes} icon={<TrashIcon size={14} />} label="Clear All" variant="neutral" title="Remove infections + firewalls" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Click a node to…</div>
                <div className="grid grid-cols-2 gap-2">
                  <ModeBtn active={clickMode === "infect"} onClick={() => setClickMode("infect")}><VirusIcon size={14} /> Infect / Heal</ModeBtn>
                  <ModeBtn active={clickMode === "firewall"} onClick={() => setClickMode("firewall")}><FirewallIcon size={14} /> Add Firewall</ModeBtn>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Topology & Spread</div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldLabel label="Spread Threshold (0–1)">
                    <input type="number" min={0} max={1} step={0.05} value={thresholdInput} onChange={e => setThresholdInput(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono text-slate-900 focus:border-[#00d9ff] focus:outline-none focus:ring-2 focus:ring-[#00d9ff]/25" />
                  </FieldLabel>
                  <FieldLabel label="Node Count (2–40)">
                    <input type="number" min={2} max={40} step={1} value={nodeCountInput} onChange={e => setNodeCountInput(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono text-slate-900 focus:border-[#00d9ff] focus:outline-none focus:ring-2 focus:ring-[#00d9ff]/25" />
                  </FieldLabel>
                </div>
                <ActionButton onClick={rebuildNetwork} icon={<RefreshIcon size={14} />} label="Rebuild Network" variant="neutral" fullWidth className="mt-2" title="Rebuild graph" />
              </div>
            </div>
          </Card>
        </div>

        {/* Log */}
        <Card title="Activity Log" icon={<ListIcon size={16} />}
          right={<button onClick={() => setLog([])} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:border-[#00d9ff] hover:text-[#0099b8]">Clear</button>}
        >
          <ActivityLog entries={log} />
        </Card>

        <footer className="mt-6 text-center text-xs text-slate-400">
          React + TypeScript + Tailwind + Chart.js · Real DoS backend · Python attack script · SIR epidemic model
        </footer>
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={"flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition " +
        (active ? "border-[#00d9ff] bg-[#00d9ff]/15 text-[#0099b8] shadow-[0_0_8px_rgba(0,217,255,0.35)]" : "border-slate-300 bg-white text-slate-600 hover:border-[#00d9ff]/60 hover:text-[#0099b8]")}
    >{children}</button>
  );
}

type ActionVariant = "primary" | "success" | "danger" | "neutral";
const ELEC_BLUE_C = "#00d9ff";
const ELEC_GREEN_C = "#39ff14";
const ELEC_RED_C = "#ff073a";

function ActionButton({ onClick, icon, label, variant = "primary", fullWidth, className, title }: {
  onClick: () => void; icon: React.ReactNode; label: string; variant?: ActionVariant; fullWidth?: boolean; className?: string; title?: string;
}) {
  const variants: Record<ActionVariant, { bg: string; text: string; border: string; glow: string }> = {
    primary: { bg: ELEC_BLUE_C, text: "#0a3a44", border: ELEC_BLUE_C, glow: `0 0 10px ${ELEC_BLUE_C}77` },
    success: { bg: ELEC_GREEN_C, text: "#0d3a00", border: ELEC_GREEN_C, glow: `0 0 10px ${ELEC_GREEN_C}77` },
    danger:  { bg: ELEC_RED_C, text: "#ffffff", border: ELEC_RED_C, glow: `0 0 10px ${ELEC_RED_C}66` },
    neutral: { bg: "#ffffff", text: "#334155", border: "#cbd5e1", glow: "none" },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} title={title}
      className={"flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wider transition hover:brightness-95 active:scale-[0.98] " + (fullWidth ? "w-full " : "") + (className ?? "")}
      style={{ background: v.bg, color: v.text, borderColor: v.border, boxShadow: v.glow }}
    >{icon}<span>{label}</span></button>
  );
}

function RiskFormula({ risk }: { risk: ReturnType<typeof computeRisk> }) {
  const parts: { label: string; w: number; v: number }[] = [];
  if (risk.passwordActive)  parts.push({ label: "PW", w: 0.3, v: risk.passwordRisk });
  if (risk.ddosActive)      parts.push({ label: "DoS", w: 0.4, v: risk.ddosRisk });
  if (risk.infectionActive) parts.push({ label: "Inf", w: 0.3, v: risk.infectionRisk });
  if (parts.length === 0) return <span className="font-mono text-slate-500">No active modules — provide inputs to compute risk.</span>;
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
      <span className="text-slate-500">Risk =</span>
      {parts.map((p, i) => (
        <span key={p.label} className="text-slate-700">
          {i > 0 && <span className="mr-1 text-slate-400">+</span>}
          <span className="text-slate-500">{(p.w / totalW).toFixed(2)}·</span>
          <span className="font-semibold">{p.label}</span>
          <span className="text-slate-400">({p.v.toFixed(0)})</span>
        </span>
      ))}
      <span className="ml-auto font-semibold text-slate-900">= {risk.score.toFixed(1)}</span>
    </div>
  );
}

function RiskBar({ label, weight, value, hint, active }: { label: string; weight: string; value: number; hint: string; active: boolean }) {
  let color: string, textColor: string;
  if (!active) { color = "#cbd5e1"; textColor = "#94a3b8"; }
  else if (value < 33) { color = ELEC_GREEN; textColor = "#1a7a00"; }
  else if (value < 66) { color = ELEC_YELLOW; textColor = "#9a7b00"; }
  else { color = ELEC_RED; textColor = "#c2002e"; }
  return (
    <div className={"rounded-lg border bg-slate-50 p-3 transition " + (active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70")}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="font-mono text-[10px] text-slate-400">{active ? `w=${weight}` : "inactive"}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${active ? value : 0}%`, background: color, boxShadow: `0 0 6px ${color}aa` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{hint}</span>
        <span className="font-mono font-semibold" style={{ color: textColor }}>{value.toFixed(0)}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, color, textOverride }: { label: string; value: string; color: string; textOverride?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono font-bold" style={{ color: textOverride ?? color }}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}aa` }} />
      {label}
    </span>
  );
}
