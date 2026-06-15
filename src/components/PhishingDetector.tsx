import { useState, useCallback } from "react";
import { analyzeUrl, PhishingResult } from "../utils/phishing";

// ── Color tokens ─────────────────────────────────────────────────────────────
const GREEN  = "#39ff14";
const YELLOW = "#fff200";
const RED    = "#ff073a";

function verdictColor(verdict: PhishingResult["verdict"]) {
  if (verdict === "Safe")       return { bg: `${GREEN}18`,  border: `${GREEN}60`,  text: "#1a7a00" };
  if (verdict === "Suspicious") return { bg: `${YELLOW}18`, border: `${YELLOW}60`, text: "#9a7b00" };
  return                               { bg: `${RED}18`,    border: `${RED}60`,    text: "#c2002e" };
}

function scoreColor(score: number) {
  if (score < 25) return GREEN;
  if (score < 50) return YELLOW;
  return RED;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  onScore: (score: number) => void;
}

export function PhishingDetector({ onScore }: Props) {
  const [url, setUrl]       = useState("");
  const [result, setResult] = useState<PhishingResult | null>(null);

  const analyze = useCallback(() => {
    if (!url.trim()) return;
    const r = analyzeUrl(url);
    setResult(r);
    onScore(r.score);
  }, [url, onScore]);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") analyze(); };

  const color = result ? scoreColor(result.score) : "#cbd5e1";
  const circumference = 2 * Math.PI * 46; // r = 46

  return (
    <div className="space-y-3">
      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter a URL to analyze…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00d9ff] focus:outline-none focus:ring-2 focus:ring-[#00d9ff]/25"
        />
        <button
          onClick={analyze}
          className="shrink-0 rounded-md border border-[#00d9ff] px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:brightness-95 active:scale-[0.98]"
          style={{ background: "#00d9ff", color: "#0a3a44", boxShadow: "0 0 10px #00d9ff77" }}
        >
          Analyze
        </button>
      </div>

      {result && (
        <>
          {/* Score gauge + verdict */}
          <div className="flex items-center gap-5">
            {/* Circular gauge */}
            <div className="relative flex-shrink-0" style={{ width: 100, height: 100 }}>
              <svg viewBox="0 0 100 100" className="block" style={{ width: 100, height: 100 }}>
                {/* Background ring */}
                <circle cx="50" cy="50" r="46" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                {/* Score arc */}
                <circle
                  cx="50" cy="50" r="46" fill="none"
                  stroke={color}
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * result.score) / 100}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease", filter: `drop-shadow(0 0 4px ${color}88)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-bold" style={{ color }}>{result.score}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">risk</span>
              </div>
            </div>

            {/* Verdict badge */}
            <div className="flex-1 space-y-2">
              {(() => {
                const vc = verdictColor(result.verdict);
                return (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                    style={{ background: vc.bg, borderColor: vc.border, color: vc.text }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: vc.border, boxShadow: `0 0 6px ${vc.border}` }} />
                    {result.verdict}
                  </div>
                );
              })()}
              <div className="text-xs text-slate-500">
                {result.verdict === "Safe" && "This URL appears legitimate based on heuristic checks."}
                {result.verdict === "Suspicious" && "This URL shows some signs of phishing — proceed with caution."}
                {result.verdict === "Phishing" && "This URL is very likely a phishing attempt — do NOT submit credentials."}
              </div>
            </div>
          </div>

          {/* Flagged reasons */}
          {result.reasons.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Flagged Indicators ({result.reasons.length})
              </div>
              <ul className="space-y-1.5">
                {result.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-[#ff073a]">⚠</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.reasons.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 text-center">
              ✅ No suspicious indicators found.
            </div>
          )}
        </>
      )}

      {/* Educational disclaimer */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-400 leading-relaxed">
        <strong className="text-slate-500">Educational Notice:</strong> This tool uses client-side heuristics for
        demonstration purposes only. Real phishing detection relies on threat-intelligence feeds, machine-learning
        classifiers, and browser safe-browsing APIs. Never rely solely on this tool for security decisions.
      </div>
    </div>
  );
}
