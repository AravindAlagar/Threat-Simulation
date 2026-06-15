import { useState, useEffect, useRef } from "react";
import { analyzePassword, PasswordAnalysis } from "../utils/password";

interface Props {
  onChange: (a: PasswordAnalysis) => void;
}

// Electric palette
const STRENGTH_COLORS: Record<string, string> = {
  Empty: "#94a3b8",
  Weak: "#ff073a",         // electric red
  Moderate: "#fff200",     // electric yellow
  Strong: "#39ff14",       // electric green
  "Very Strong": "#00d9ff",// electric blue
};

export function PasswordAnalyzer({ onChange }: Props) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const analysis = analyzePassword(pw);
  const color = STRENGTH_COLORS[analysis.strength];

  const lastSent = useRef("");
  useEffect(() => {
    const sig = `${analysis.entropy}|${analysis.strength}`;
    if (sig !== lastSent.current) {
      lastSent.current = sig;
      onChange(analysis);
    }
  }, [analysis, onChange]);

  const checks = [
    { label: "a-z", ok: analysis.hasLower },
    { label: "A-Z", ok: analysis.hasUpper },
    { label: "0-9", ok: analysis.hasDigit },
    { label: "!@#", ok: analysis.hasSpecial },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="Type a password to test…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00d9ff] focus:outline-none focus:ring-2 focus:ring-[#00d9ff]/25"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-[#0099b8]"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${analysis.scorePercent}%`,
            background: color,
            boxShadow: pw ? `0 0 8px ${color}aa` : "none",
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide" style={{ color }}>
          {analysis.strength}
        </span>
        <span className="text-slate-500">
          Entropy: <span className="font-mono font-semibold text-slate-800">{analysis.entropy.toFixed(1)} bits</span>
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Estimated crack time</span>
          <span className="font-mono font-semibold" style={{ color }}>
            {analysis.crackTime}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-slate-500">Charset size</span>
          <span className="font-mono text-slate-800">{analysis.charsetSize}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-slate-500">Length</span>
          <span className="font-mono text-slate-800">{analysis.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {checks.map(c => (
          <span
            key={c.label}
            className={
              "rounded-md border px-2 py-0.5 text-xs font-mono " +
              (c.ok
                ? "border-[#00d9ff]/40 bg-[#00d9ff]/10 text-[#0099b8]"
                : "border-slate-200 bg-slate-50 text-slate-400")
            }
          >
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>

      {analysis.penalties.length > 0 && (
        <div className="rounded-lg border border-[#fff200]/60 bg-[#fff200]/15 p-2 text-xs text-amber-800">
          <div className="mb-1 font-semibold">Penalties applied:</div>
          <ul className="list-inside list-disc space-y-0.5">
            {analysis.penalties.map(p => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
