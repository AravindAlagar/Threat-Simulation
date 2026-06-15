import { useCallback, useMemo, useRef, useState } from "react";
import { Card } from "./components/Card";
import { RiskGauge } from "./components/RiskGauge";
import { PasswordAnalyzer } from "./components/PasswordAnalyzer";
import { LiveAttackPanel, ServerMetrics } from "./components/LiveAttackPanel";
import { PhishingDetector } from "./components/PhishingDetector";
import { ActivityLog } from "./components/ActivityLog";
import {
  ShieldIcon,
  TargetIcon,
  LockIcon,
  BoltIcon,
  PhishingIcon,
  ListIcon,
} from "./components/Icons";
import { PasswordAnalysis } from "./utils/password";
import { computeRisk } from "./utils/risk";
import { LogEntry, makeEntry, MAX_LOG, Severity } from "./utils/log";

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

  // ── Phishing state ─────────────────────────────────────────────────────
  const [phishingScore, setPhishingScore] = useState<number>(0);

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

  // ── Phishing score callback ────────────────────────────────────────────
  const handlePhishingScore = useCallback((score: number) => {
    setPhishingScore(score);
    if (score >= 50) pushLog("CRITICAL", `Phishing analysis: score ${score}/100 — likely phishing`);
    else if (score >= 25) pushLog("WARNING", `Phishing analysis: score ${score}/100 — suspicious`);
    else pushLog("INFO", `Phishing analysis: score ${score}/100 — appears safe`);
  }, [pushLog]);

  // ── Risk computation ───────────────────────────────────────────────────
  const risk = useMemo(
    () =>
      computeRisk({
        passwordEntropy: pwAnalysis?.entropy ?? 0,
        passwordProvided: (pwAnalysis?.length ?? 0) > 0,
        ddosActive: serverMetrics !== null,
        serverStatus: serverMetrics?.serverStatus ?? "ONLINE",
        activeRequests: serverMetrics?.activeRequests ?? 0,
        avgLatencyMs: serverMetrics?.avgLatencyMs ?? 0,
        phishingScore,
      }),
    [pwAnalysis, serverMetrics, phishingScore]
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
                DoS Stress Testing · Password Strength Analysis · Phishing URL Detection
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
                label="Phishing Risk" weight="30%" value={risk.phishingRisk} active={risk.phishingActive}
                hint={risk.phishingActive ? `Score: ${phishingScore}/100` : "No URL analyzed"}
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

          <Card title="Phishing URL Detection" icon={<PhishingIcon size={16} />}>
            <PhishingDetector onScore={handlePhishingScore} />
          </Card>
        </div>

        {/* Log */}
        <Card title="Activity Log" icon={<ListIcon size={16} />}
          right={<button onClick={() => setLog([])} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:border-[#00d9ff] hover:text-[#0099b8]">Clear</button>}
        >
          <ActivityLog entries={log} />
        </Card>

        <footer className="mt-6 text-center text-xs text-slate-400">
          React + TypeScript + Tailwind + Chart.js · DoS Stress Testing · Password Strength Analysis · Phishing URL Detection
        </footer>
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────




function RiskFormula({ risk }: { risk: ReturnType<typeof computeRisk> }) {
  const parts: { label: string; w: number; v: number }[] = [];
  if (risk.passwordActive)  parts.push({ label: "PW", w: 0.3, v: risk.passwordRisk });
  if (risk.ddosActive)      parts.push({ label: "DoS", w: 0.4, v: risk.ddosRisk });
  if (risk.phishingActive)  parts.push({ label: "Phish", w: 0.3, v: risk.phishingRisk });
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
