export type Severity = "INFO" | "WARNING" | "CRITICAL";

export interface LogEntry {
  id: number;
  timestamp: string;
  severity: Severity;
  message: string;
}

export const MAX_LOG = 50;

let nextId = 1;
export function makeEntry(severity: Severity, message: string): LogEntry {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return {
    id: nextId++,
    timestamp: `${hh}:${mm}:${ss}`,
    severity,
    message,
  };
}
