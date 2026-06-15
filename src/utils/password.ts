export type Strength = "Empty" | "Weak" | "Moderate" | "Strong" | "Very Strong";

export interface PasswordAnalysis {
  entropy: number;
  rawEntropy: number;
  strength: Strength;
  crackTime: string;
  charsetSize: number;
  length: number;
  penalties: string[];
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  scorePercent: number; // 0-100
}

const COMMON_PATTERNS = [
  "password", "123456", "qwerty", "admin", "letmein", "welcome",
  "monkey", "iloveyou", "abc123", "111111", "dragon", "sunshine",
  "princess", "football", "master", "login", "passw0rd", "trustno1",
];

function hasSequential(pw: string): boolean {
  const lower = pw.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    if (b - a === 1 && c - b === 1) return true;
    if (a - b === 1 && b - c === 1) return true;
  }
  return false;
}

function hasRepeated(pw: string): boolean {
  for (let i = 0; i < pw.length - 2; i++) {
    if (pw[i] === pw[i + 1] && pw[i + 1] === pw[i + 2]) return true;
  }
  return false;
}

function hasCommonPattern(pw: string): boolean {
  const lower = pw.toLowerCase();
  return COMMON_PATTERNS.some(p => lower.includes(p));
}

export function analyzePassword(password: string): PasswordAnalysis {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasDigit) charsetSize += 10;
  if (hasSpecial) charsetSize += 32;

  const rawEntropy = length === 0 || charsetSize === 0
    ? 0
    : length * Math.log2(charsetSize);

  let entropy = rawEntropy;
  const penalties: string[] = [];

  if (length > 0) {
    if (hasCommonPattern(password)) {
      entropy *= 0.8;
      penalties.push("Common pattern (-20%)");
    }
    if (hasSequential(password)) {
      entropy *= 0.85;
      penalties.push("Sequential chars (-15%)");
    }
    if (hasRepeated(password)) {
      entropy *= 0.9;
      penalties.push("Repeated chars (-10%)");
    }
  }

  let strength: Strength;
  let crackTime: string;

  if (length === 0) {
    strength = "Empty";
    crackTime = "—";
  } else if (entropy < 40) {
    strength = "Weak";
    crackTime = "Instant";
  } else if (entropy < 60) {
    strength = "Moderate";
    crackTime = "Minutes to Hours";
  } else if (entropy < 80) {
    strength = "Strong";
    crackTime = "Years";
  } else {
    strength = "Very Strong";
    crackTime = "Practically Unbreakable";
  }

  // Cap visual score at 100 (entropy 100+)
  const scorePercent = Math.min(100, (entropy / 100) * 100);

  return {
    entropy,
    rawEntropy,
    strength,
    crackTime,
    charsetSize,
    length,
    penalties,
    hasLower,
    hasUpper,
    hasDigit,
    hasSpecial,
    scorePercent,
  };
}
