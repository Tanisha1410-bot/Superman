/**
 * Voice transcript normalization for the Chrono email client.
 *
 * Handles two classes of correction:
 * 1. Spoken email-address patterns  ("tiya at the rate gmail dot com" → "tiya@gmail.com")
 * 2. Fuzzy contact-name correction  ("Tia" → "Tiya" when within Levenshtein distance 2)
 */

// ── Levenshtein distance (no external deps) ────────────────────────
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // deletion
        dp[i][j - 1] + 1,     // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[la][lb];
}

// ── Known TLDs for email-pattern heuristic ─────────────────────────
const KNOWN_TLDS = new Set([
  "com", "in", "org", "net", "dev", "io", "co", "edu", "gov", "info",
  "biz", "me", "us", "uk", "ai", "app", "xyz",
]);

// ── Spoken-symbol substitution for email patterns ──────────────────

/**
 * Detects spoken email-address patterns and converts them to proper email syntax.
 *
 * Handles:
 *   "at the rate" / "at therate" / "at" (when followed by a domain-like word) → "@"
 *   "dot" between word tokens where context looks like an email/domain          → "."
 *   "underscore" → "_"
 *   "dash" / "hyphen" → "-"
 *
 * Conservative: only applies dot/at substitution when surrounding tokens form
 * an email-shaped pattern (word @ word . tld), not in normal sentences.
 */
export function normalizeEmailPatterns(text: string): string {
  // Step 1: Replace "underscore", "dash", "hyphen" — these are unambiguous
  let result = text
    .replace(/\bunderscore\b/gi, "_")
    .replace(/\b(dash|hyphen)\b/gi, "-");

  // Step 2: Detect and normalise "at the rate" / "at" patterns for email "@"
  // Pattern: <word> (at the rate | at therate | at) <word> (dot <word>)+
  //
  // We use a regex that captures the full email-shaped spoken sequence and
  // reconstruct it.  The approach is greedy-left: find the longest match.
  //
  // (?:at the rate|at therate|at)  →  "@"
  // Then one or more  (word dot word)  segments with the last word in KNOWN_TLDS

  const emailPatternRe =
    /(\b\w[\w_-]*)\s+(?:at\s+the\s*rate|at\s+therate|at)\s+(\w[\w_-]*(?:\s+dot\s+\w[\w_-]*)+)\b/gi;

  result = result.replace(emailPatternRe, (_match, localPart: string, domainSpoken: string) => {
    // domainSpoken looks like "gmail dot com" or "corsair dot dev"
    const domainParts = domainSpoken.split(/\s+dot\s+/i);

    // Only convert if the last segment is a known TLD — prevents false positives
    const lastPart = domainParts[domainParts.length - 1].toLowerCase().trim();
    if (!KNOWN_TLDS.has(lastPart)) {
      // Not an email pattern — return original text unchanged
      return _match;
    }

    const domain = domainParts.join(".");
    return `${localPart}@${domain}`;
  });

  // Step 3: Clean up any residual spaces inside what now looks like an email
  // e.g. "tiya @gmail .com" → "tiya@gmail.com"
  result = result.replace(
    /(\w[\w._-]*)\s*@\s*([\w._-]+)/g,
    (_m, local: string, domain: string) => `${local}@${domain}`
  );

  return result;
}

// ── Fuzzy contact-name correction ──────────────────────────────────

export interface KnownContact {
  name: string;
  email: string;
}

/**
 * For each word in the transcript, if it's within Levenshtein distance ≤ 2
 * of a known contact's first name, replace it with the correctly-spelled name.
 *
 * Skips very short words (≤ 2 chars) to avoid false corrections on
 * prepositions / articles.
 */
export function fuzzyCorrectNames(
  text: string,
  contacts: KnownContact[]
): string {
  if (contacts.length === 0) return text;

  // Build a map of lowercase first-name → canonical first-name
  const nameMap = new Map<string, string>();
  for (const c of contacts) {
    const firstName = c.name.split(/\s+/)[0];
    if (firstName && firstName.length > 2) {
      nameMap.set(firstName.toLowerCase(), firstName);
    }
  }

  if (nameMap.size === 0) return text;

  const words = text.split(/(\s+)/); // keep whitespace tokens for re-joining
  const corrected = words.map((token) => {
    // Skip whitespace and very short tokens
    if (/^\s+$/.test(token) || token.length <= 2) return token;

    const lower = token.toLowerCase();

    // Exact match — already correct
    if (nameMap.has(lower)) return nameMap.get(lower)!;

    // Fuzzy match
    let bestMatch: string | null = null;
    let bestDist = 3; // threshold: distance ≤ 2
    for (const [nameLower, canonical] of nameMap) {
      // Quick length check to skip obviously different words
      if (Math.abs(nameLower.length - lower.length) > 2) continue;

      const dist = levenshtein(lower, nameLower);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = canonical;
      }
    }

    return bestMatch ?? token;
  });

  return corrected.join("");
}

// ── Combined normalisation pipeline ────────────────────────────────

/**
 * Full voice transcript normalisation:
 * 1. Normalise spoken email patterns into proper addresses
 * 2. Fuzzy-correct contact names against the known contacts list
 */
export function normalizeVoiceTranscript(
  text: string,
  contacts: KnownContact[] = []
): string {
  let result = normalizeEmailPatterns(text);
  result = fuzzyCorrectNames(result, contacts);
  return result;
}
