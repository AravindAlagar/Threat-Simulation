/**
 * phishing.ts — Client-side Phishing URL Analyzer
 *
 * Performs rule-based heuristic analysis on a URL to determine
 * how likely it is to be a phishing attempt. Each check contributes
 * points to a cumulative risk score (0–100).
 *
 * This is a demonstrative / educational tool — it does NOT replace
 * real-time threat-intelligence feeds or browser safe-browsing APIs.
 */

// ── Result types ─────────────────────────────────────────────────────────────

export interface PhishingResult {
  /** Overall risk score 0–100. */
  score: number;
  /** Human-readable verdict. */
  verdict: "Safe" | "Suspicious" | "Phishing";
  /** List of reasons that contributed to the score. */
  reasons: string[];
}

// ── Suspicious keyword & TLD lists ───────────────────────────────────────────

const SUSPICIOUS_KEYWORDS = [
  "login", "verify", "account", "secure", "bank",
  "password", "update", "confirm",
];

const SUSPICIOUS_TLDS = [
  "top",
  "xyz",
  "cfd",
  "buzz",
  "click",
  "work",
  "shop",
  "online",
  "site",
  "live",
  "icu",
  "info",
  "rest",
  "cam",
  "support",
  "world",
  "gq",
  "ml",
  "cf",
  "tk",
  "ga",
  "pw",
  "fit",
  "monster",
  "quest",
  "sbs",
  "fun",
  "club",
  "space",
  "website",
  "digital",
  "win",
  "vip",
  "pro",
  "stream",
  "trade"
];

// ── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Analyse a URL string and return a phishing risk assessment.
 * All checks are purely client-side — no network requests are made.
 */
export function analyzeUrl(raw: string): PhishingResult {
  const reasons: string[] = [];
  let score = 0;

  // Normalise — if no protocol provided, prepend "http://"
  let urlString = raw.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = "http://" + urlString;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    // If the URL is completely unparseable, treat it as maximally suspicious.
    return { score: 100, verdict: "Phishing", reasons: ["URL could not be parsed — highly suspicious format"] };
  }

  // 1. Missing HTTPS ──────────────────────────────────────────────────────────
  if (parsed.protocol !== "https:") {
    score += 15;
    reasons.push("Connection is not HTTPS — data is transmitted in plain text");
  }

  // 2. IP address instead of domain ───────────────────────────────────────────
  //    Covers both IPv4 and bracket-wrapped IPv6.
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  const hostOnly = parsed.hostname.replace(/^\[|\]$/g, "");
  if (ipv4.test(hostOnly) || hostOnly.includes(":")) {
    score += 25;
    reasons.push("URL uses a raw IP address instead of a domain name");
  }

  // 3. Excessive URL length ───────────────────────────────────────────────────
  if (raw.length > 75) {
    score += 10;
    reasons.push(`URL is unusually long (${raw.length} characters)`);
  }

  // 4. Suspicious keywords in hostname or path ────────────────────────────────
  const lower = parsed.hostname + parsed.pathname;
  const found = SUSPICIOUS_KEYWORDS.filter((kw) => lower.includes(kw));
  if (found.length > 0) {
    score += Math.min(25, found.length * 10);
    reasons.push(`Contains suspicious keywords: ${found.join(", ")}`);
  }

  // 5. Excessive subdomains (> 3 dots in the hostname) ────────────────────────
  const dotCount = (parsed.hostname.match(/\./g) || []).length;
  if (dotCount > 3) {
    score += 15;
    reasons.push(`Hostname has excessive subdomains (${dotCount} levels)`);
  }

  // 6. Suspicious TLD ─────────────────────────────────────────────────────────
  const tldMatch = SUSPICIOUS_TLDS.find((tld) =>
    parsed.hostname.endsWith(tld),
  );
  if (tldMatch) {
    score += 15;
    reasons.push(`Uses suspicious top-level domain: ${tldMatch}`);
  }

  // Clamp to 0–100
  score = Math.min(100, Math.max(0, score));

  // Derive verdict
  let verdict: PhishingResult["verdict"];
  if (score >= 50) verdict = "Phishing";
  else if (score >= 25) verdict = "Suspicious";
  else verdict = "Safe";

  return { score, verdict, reasons };
}
