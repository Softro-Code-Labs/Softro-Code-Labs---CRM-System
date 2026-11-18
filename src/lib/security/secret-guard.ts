/**
 * Spots text that looks like a password, key or code, so it can't be saved in the CRM by mistake.
 * Secrets belong in the company password manager; the CRM only records *where* they are.
 * Returns a short reason, or null if the text looks fine.
 */
const PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/, "a Stripe key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS key"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, "a GitHub token"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/\bAIza[0-9A-Za-z_-]{30,}/, "a Google API key"],
  [/\bre_[A-Za-z0-9]{16,}/, "a Resend key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "a token"],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i, "a connection string with a password"],
  [/\b(?:password|passwd|pwd|pass|secret|api[ _-]?key|token|otp|pin)\s*[:=]\s*\S{4,}/i, "a password or key"],
  [/(?:\b\d{4}[\s-]?\d{4}\b[\s,;]*){3,}/, "backup codes"],
  [/\b[A-Z2-7]{4}(?:\s?[A-Z2-7]{4}){5,}\b/, "a two-step (authenticator) key"],
];

/** Long runs of mixed letters and digits, like generated keys ("k8Fz2…" with 32+ characters). */
function randomLooking(text: string) {
  for (const word of text.match(/[A-Za-z0-9_+/=-]{32,}/g) ?? []) {
    if (/[a-z]/.test(word) && /[A-Z]/.test(word) && /\d/.test(word)) return true;
  }
  return false;
}

export function looksLikeSecret(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [re, what] of PATTERNS) if (re.test(text)) return what;
  if (randomLooking(text)) return "a key or token";
  return null;
}

export const secretMessage = (what: string) =>
  `This looks like ${what}. Don't save secrets in the CRM: keep them in the password manager and write here only where they are.`;
