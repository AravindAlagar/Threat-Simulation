import { RiskAssessment } from "../utils/risk";

interface Props {
  risk: RiskAssessment;
}

// Electric palette: green → yellow → red
function levelColor(score: number) {
  const clamped = Math.min(100, Math.max(0, score));
  let r: number, g: number, b: number;
  if (clamped < 50) {
    // electric green (#39ff14) → electric yellow (#fff200)
    const t = clamped / 50;
    r = Math.round(57 + (255 - 57) * t);
    g = Math.round(255 + (242 - 255) * t);
    b = Math.round(20 + (0 - 20) * t);
  } else {
    // electric yellow (#fff200) → electric red (#ff073a)
    const t = (clamped - 50) / 50;
    r = Math.round(255 + (255 - 255) * t);
    g = Math.round(242 + (7 - 242) * t);
    b = Math.round(0 + (58 - 0) * t);
  }
  return `rgb(${r},${g},${b})`;
}

export function RiskGauge({ risk }: Props) {
  const size = 180;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, risk.score));
  const dash = (pct / 100) * circ;
  const color = levelColor(risk.score);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{
              transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease",
              filter: `drop-shadow(0 0 6px ${color}88)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold" style={{ color }}>
            {risk.score.toFixed(0)}
          </div>
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Risk Score
          </div>
        </div>
      </div>
      <div
        className="mt-3 rounded-full border px-4 py-1 text-sm font-semibold"
        style={{
          background: `${color}15`,
          color,
          borderColor: `${color}55`,
        }}
      >
        {risk.level}
      </div>
    </div>
  );
}
