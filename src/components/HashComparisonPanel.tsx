import { useState, useCallback } from "react";
import { HashEntry } from "../utils/hashing";

// ── Color helpers ────────────────────────────────────────────────────────────

const SECURITY_BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  Broken:         { bg: "#ff073a18", border: "#ff073a60", text: "#c2002e" },
  Weak:           { bg: "#ff8c0018", border: "#ff8c0060", text: "#b45e00" },
  Moderate:       { bg: "#fff20018", border: "#fff20060", text: "#9a7b00" },
  Strong:         { bg: "#39ff1418", border: "#39ff1460", text: "#1a7a00" },
  "Gold Standard":{ bg: "#00d9ff18", border: "#00d9ff60", text: "#0077a0" },
};

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  entries: HashEntry[];
  loading: boolean;
}

export function HashComparisonPanel({ entries, loading }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyHash = useCallback((id: string, hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#00d9ff]" />
        Computing hashes…
      </div>
    );
  }

  if (entries.length === 0) return null;

  // Find max crackLog10 for bar scaling
  const maxLog = Math.max(...entries.map(e => e.crackLog10), 1);

  return (
    <div className="space-y-4">
      {/* Section 1 — Hash Output Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Algorithm</th>
              <th className="px-3 py-2">Hash</th>
              <th className="px-3 py-2 text-right">Compute</th>
              <th className="px-3 py-2 text-center">Security</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const badge = SECURITY_BADGE_STYLES[entry.security] ?? SECURITY_BADGE_STYLES.Moderate;
              const truncated = entry.hash.length > 20
                ? entry.hash.slice(0, 16) + "…"
                : entry.hash;

              return (
                <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {entry.algorithm}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => copyHash(entry.id, entry.hash)}
                      title={`Click to copy full hash\n${entry.hash}`}
                      className="group flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left font-mono text-slate-600 transition hover:bg-[#00d9ff]/10 hover:text-[#0099b8]"
                    >
                      <span className="max-w-[180px] truncate">{truncated}</span>
                      <span className="shrink-0 text-[9px] text-slate-400 group-hover:text-[#00d9ff] transition-colors">
                        {copiedId === entry.id ? "✓" : "⎘"}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                    {entry.computeTimeMs < 1
                      ? `${(entry.computeTimeMs * 1000).toFixed(0)}µs`
                      : `${entry.computeTimeMs.toFixed(1)}ms`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: badge.border, boxShadow: `0 0 4px ${badge.border}` }}
                      />
                      {entry.security}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Section 2 — GPU Crack-Time Comparison */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          ⚡ GPU Brute-Force Time — NVIDIA RTX 4090
        </div>
        <div className="space-y-2.5">
          {entries.map((entry) => {
            // Log-scale bar width: use ratio of log10 values
            const barPercent = maxLog > 0 && entry.crackLog10 > 0
              ? Math.max(3, (entry.crackLog10 / maxLog) * 100)
              : 3; // minimum bar width for visibility

            return (
              <div key={entry.id}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-700">{entry.algorithm}</span>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: entry.color }}>
                    {entry.crackTime}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${barPercent}%`,
                      background: entry.color,
                      boxShadow: `0 0 6px ${entry.color}88`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-slate-200 pt-2.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#ff073a" }} /> Fast to crack
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#00d9ff" }} /> Practically impossible
          </span>
        </div>
      </div>

      {/* Section 3 — Educational Callout */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-400 leading-relaxed">
        <strong className="text-slate-500">Why does the algorithm matter?</strong>{" "}
        MD5 and SHA-256 are designed for <em>speed</em> — a single GPU can test billions of passwords per second.
        bcrypt and Argon2id are deliberately <em>slow</em> and memory-hard, making brute-force attacks
        economically infeasible even with dedicated hardware. Always use Argon2id or bcrypt for storing passwords.
      </div>
    </div>
  );
}
