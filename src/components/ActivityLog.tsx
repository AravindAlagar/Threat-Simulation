import { LogEntry } from "../utils/log";

interface Props {
  entries: LogEntry[];
}

// Electric palette for severity
const SEVERITY_STYLE: Record<string, string> = {
  INFO: "text-[#0099b8]",
  WARNING: "text-[#9a7b00]",
  CRITICAL: "text-[#c2002e]",
};

const SEVERITY_BADGE: Record<string, string> = {
  INFO: "bg-[#00d9ff]/10 text-[#0099b8] border-[#00d9ff]/40",
  WARNING: "bg-[#fff200]/20 text-[#9a7b00] border-[#fff200]/60",
  CRITICAL: "bg-[#ff073a]/10 text-[#c2002e] border-[#ff073a]/40",
};

export function ActivityLog({ entries }: Props) {
  return (
    <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
      {entries.length === 0 ? (
        <div className="flex h-full items-center justify-center text-slate-400">
          No events yet. Awaiting telemetry…
        </div>
      ) : (
        <ul className="space-y-1">
          {entries.map(e => (
            <li key={e.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-slate-400">[{e.timestamp}]</span>
              <span
                className={
                  "rounded border px-1.5 text-[10px] font-bold " +
                  SEVERITY_BADGE[e.severity]
                }
              >
                {e.severity}
              </span>
              <span className={SEVERITY_STYLE[e.severity]}>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
