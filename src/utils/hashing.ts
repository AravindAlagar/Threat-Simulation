/**
 * hashing.ts — Real client-side hashing & GPU crack-time estimates
 *
 * Uses `hash-wasm` (WebAssembly) to compute actual hashes in the browser.
 * Crack-time estimates are based on real NVIDIA RTX 4090 Hashcat benchmarks.
 *
 * All computation is client-side — no passwords leave the browser.
 */

import { md5, sha256, sha512, bcrypt, argon2id } from "hash-wasm";

// ── Types ────────────────────────────────────────────────────────────────────

export type SecurityRating = "Broken" | "Weak" | "Moderate" | "Strong" | "Gold Standard";

export interface HashEntry {
  /** Algorithm display name */
  algorithm: string;
  /** Short identifier */
  id: string;
  /** Computed hash string (hex or encoded) */
  hash: string;
  /** Time taken to compute this hash (ms) */
  computeTimeMs: number;
  /** Security rating for password storage */
  security: SecurityRating;
  /** One-line explanation */
  description: string;
  /** Estimated time for RTX 4090 to brute-force at this entropy */
  crackTime: string;
  /** Numeric log10 of crack seconds (for bar chart scaling) */
  crackLog10: number;
  /** Color for the security badge */
  color: string;
}

export interface HashResults {
  entries: HashEntry[];
  /** True while hashes are being computed */
  computing: boolean;
}

// ── RTX 4090 Hashcat benchmark rates (hashes per second) ─────────────────────

const GPU_RATES: Record<string, number> = {
  md5:      164_000_000_000, // 164 billion H/s
  sha256:    22_000_000_000, // 22 billion H/s
  sha512:     8_500_000_000, // 8.5 billion H/s
  bcrypt:           10_000,  // cost=10 → ~10k H/s
  argon2id:          1_500,  // m=64KB, t=3 → ~1.5k H/s
};

// ── Algorithm metadata ───────────────────────────────────────────────────────

const ALGO_META: Record<string, { security: SecurityRating; description: string; color: string }> = {
  md5: {
    security: "Broken",
    description: "Designed for speed — a single GPU tests 164 billion guesses/sec",
    color: "#ff073a",
  },
  sha256: {
    security: "Weak",
    description: "Faster than bcrypt — GPUs test 22 billion guesses/sec",
    color: "#ff8c00",
  },
  sha512: {
    security: "Weak",
    description: "Slightly slower than SHA-256 but still GPU-friendly at 8.5B H/s",
    color: "#ff8c00",
  },
  bcrypt: {
    security: "Strong",
    description: "Deliberately slow — GPU limited to ~10,000 guesses/sec (cost=10)",
    color: "#39ff14",
  },
  argon2id: {
    security: "Gold Standard",
    description: "Memory-hard — GPU limited to ~1,500 guesses/sec (64KB RAM per hash)",
    color: "#00d9ff",
  },
};

// ── Crack-time estimation ────────────────────────────────────────────────────

/**
 * Given entropy in bits, estimate brute-force time for each algorithm.
 * Uses average case: keyspace / 2 (expected attempts to find a match).
 */
function estimateCrackTime(entropyBits: number, hashRate: number): { display: string; log10: number } {
  if (entropyBits <= 0) return { display: "—", log10: -Infinity };

  // Total keyspace = 2^entropy.  Average attempts = keyspace / 2.
  // Time = average_attempts / hash_rate
  const log2Keyspace = entropyBits;
  const log2Rate = Math.log2(hashRate);
  const log2Seconds = log2Keyspace - 1 - log2Rate; // subtract 1 for /2 average

  if (log2Seconds < 0) return { display: "< 1 second", log10: 0 };

  const log10Seconds = log2Seconds * Math.log10(2);

  // Convert to human-readable
  const seconds = log10Seconds < 15 ? Math.pow(10, log10Seconds) : Infinity;

  const display = formatSeconds(seconds, log10Seconds);
  return { display, log10: Math.max(0, log10Seconds) };
}

function formatSeconds(seconds: number, log10: number): string {
  if (log10 > 30) return "Heat death of universe+";
  if (log10 > 20) return `~10^${log10.toFixed(0)} years`;

  if (seconds < 0.001) return "< 1 millisecond";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;

  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} minutes`;

  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hours`;

  const days = hours / 24;
  if (days < 365) return `${days.toFixed(0)} days`;

  const years = days / 365.25;
  if (years < 1_000) return `${years.toFixed(0)} years`;
  if (years < 1_000_000) return `${(years / 1_000).toFixed(1)}K years`;
  if (years < 1_000_000_000) return `${(years / 1_000_000).toFixed(1)}M years`;
  if (years < 1e12) return `${(years / 1_000_000_000).toFixed(1)}B years`;
  return `~10^${log10.toFixed(0)} years`;
}

// ── Hash computation ─────────────────────────────────────────────────────────

/**
 * Generate a random salt as Uint8Array.
 */
function randomSalt(length: number): Uint8Array {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Compute all hashes for a given password.
 * Returns hash strings, compute times, and crack-time estimates.
 */
export async function computeAllHashes(
  password: string,
  entropyBits: number,
): Promise<HashEntry[]> {
  if (!password) return [];

  const results: HashEntry[] = [];

  // Helper to time a hash computation
  async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
    const t0 = performance.now();
    const result = await fn();
    return { result, ms: performance.now() - t0 };
  }

  // 1. MD5
  const md5Result = await timed(() => md5(password));
  const md5Crack = estimateCrackTime(entropyBits, GPU_RATES.md5);
  results.push({
    algorithm: "MD5",
    id: "md5",
    hash: md5Result.result,
    computeTimeMs: md5Result.ms,
    ...ALGO_META.md5,
    crackTime: md5Crack.display,
    crackLog10: md5Crack.log10,
  });

  // 2. SHA-256
  const sha256Result = await timed(() => sha256(password));
  const sha256Crack = estimateCrackTime(entropyBits, GPU_RATES.sha256);
  results.push({
    algorithm: "SHA-256",
    id: "sha256",
    hash: sha256Result.result,
    computeTimeMs: sha256Result.ms,
    ...ALGO_META.sha256,
    crackTime: sha256Crack.display,
    crackLog10: sha256Crack.log10,
  });

  // 3. SHA-512
  const sha512Result = await timed(() => sha512(password));
  const sha512Crack = estimateCrackTime(entropyBits, GPU_RATES.sha512);
  results.push({
    algorithm: "SHA-512",
    id: "sha512",
    hash: sha512Result.result,
    computeTimeMs: sha512Result.ms,
    ...ALGO_META.sha512,
    crackTime: sha512Crack.display,
    crackLog10: sha512Crack.log10,
  });

  // 4. bcrypt (cost=10)
  const bcryptSalt = randomSalt(16);
  const bcryptResult = await timed(() => bcrypt({ password, salt: bcryptSalt, costFactor: 10, outputType: "encoded" }));
  const bcryptCrack = estimateCrackTime(entropyBits, GPU_RATES.bcrypt);
  results.push({
    algorithm: "bcrypt",
    id: "bcrypt",
    hash: bcryptResult.result,
    computeTimeMs: bcryptResult.ms,
    ...ALGO_META.bcrypt,
    crackTime: bcryptCrack.display,
    crackLog10: bcryptCrack.log10,
  });

  // 5. Argon2id (m=64KB, t=3, p=1)
  const argonSalt = randomSalt(16);
  const argonResult = await timed(() =>
    argon2id({
      password,
      salt: argonSalt,
      parallelism: 1,
      iterations: 3,
      memorySize: 64, // 64 KB (kept small for browser responsiveness)
      hashLength: 32,
      outputType: "encoded",
    }),
  );
  const argonCrack = estimateCrackTime(entropyBits, GPU_RATES.argon2id);
  results.push({
    algorithm: "Argon2id",
    id: "argon2id",
    hash: argonResult.result,
    computeTimeMs: argonResult.ms,
    ...ALGO_META.argon2id,
    crackTime: argonCrack.display,
    crackLog10: argonCrack.log10,
  });

  return results;
}
