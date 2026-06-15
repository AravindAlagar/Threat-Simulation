export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface RiskAssessment {
  passwordRisk: number;   // 0-100
  ddosRisk: number;       // 0-100
  infectionRisk: number;  // 0-100
  score: number;          // weighted 0-100
  level: RiskLevel;
  passwordActive: boolean;
  ddosActive: boolean;
  infectionActive: boolean;
}

export interface RiskInputs {
  /** Final entropy (after penalties) in bits. */
  passwordEntropy: number;
  /** True if the user has typed a password. */
  passwordProvided: boolean;
  /** True if the backend server is connected and streaming metrics. */
  ddosActive: boolean;
  /** Server status from the real backend: "ONLINE" | "DEGRADED" | "CRITICAL" | "DOWN". */
  serverStatus: string;
  /** Active concurrent requests on the real server. */
  activeRequests: number;
  /** Average response time in ms from the real server. */
  avgLatencyMs: number;
  /** Infection percentage (0-100). */
  infectionPercent: number;
}

/* ─── Per-module risk mappings ─────────────────────────────────────────── */

export function passwordRiskFromEntropy(entropy: number): number {
  const e = Math.max(0, entropy);
  if (e >= 120) return 0;
  if (e >= 80)  return 25 - ((e - 80) / 40) * 25;
  if (e >= 60)  return 50 - ((e - 60) / 20) * 25;
  if (e >= 40)  return 75 - ((e - 40) / 20) * 25;
  return 100 - (e / 40) * 25;
}

/**
 * DDoS risk derived from REAL server metrics.
 * Maps server status + active connections + avg latency → 0-100.
 */
export function ddosRiskFromRealMetrics(
  serverStatus: string,
  activeRequests: number,
  avgLatencyMs: number,
): number {
  if (serverStatus === "DOWN") return 100;
  if (serverStatus === "CRITICAL") return 85;

  // Use active connections and latency as real signal
  const connRisk = Math.min(50, (activeRequests / 100) * 50);
  const latRisk  = Math.min(50, (avgLatencyMs / 2000) * 50);

  let risk = connRisk + latRisk;
  if (serverStatus === "DEGRADED") risk = Math.max(risk, 40);

  return Math.min(100, Math.max(0, risk));
}

export function infectionRiskFromPercent(pct: number): number {
  const p = Math.max(0, Math.min(100, pct));
  if (p === 0) return 0;
  return Math.round(Math.sqrt(p / 100) * 100);
}

/* ─── Aggregate risk ──────────────────────────────────────────────────── */

const WEIGHTS = { password: 0.3, ddos: 0.4, infection: 0.3 };

export function computeRisk(inputs: RiskInputs): RiskAssessment {
  const passwordRisk = inputs.passwordProvided
    ? passwordRiskFromEntropy(inputs.passwordEntropy)
    : 0;

  const ddosRisk = inputs.ddosActive
    ? ddosRiskFromRealMetrics(inputs.serverStatus, inputs.activeRequests, inputs.avgLatencyMs)
    : 0;

  const infectionActive = inputs.infectionPercent > 0;
  const infectionRisk = infectionActive
    ? infectionRiskFromPercent(inputs.infectionPercent)
    : 0;

  const active: Array<[number, number]> = [];
  if (inputs.passwordProvided) active.push([passwordRisk, WEIGHTS.password]);
  if (inputs.ddosActive)       active.push([ddosRisk,     WEIGHTS.ddos]);
  if (infectionActive)         active.push([infectionRisk, WEIGHTS.infection]);

  let score = 0;
  if (active.length > 0) {
    const totalWeight = active.reduce((s, [, w]) => s + w, 0);
    score = active.reduce((s, [r, w]) => s + r * w, 0) / totalWeight;
  }

  let level: RiskLevel;
  if (score < 25)      level = "Low";
  else if (score < 50) level = "Medium";
  else if (score < 75) level = "High";
  else                 level = "Critical";

  return {
    passwordRisk,
    ddosRisk,
    infectionRisk,
    score,
    level,
    passwordActive: inputs.passwordProvided,
    ddosActive: inputs.ddosActive,
    infectionActive,
  };
}
