import { homedir } from "node:os";

const MAX_TEXT_LENGTH = 4000;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]{8,}={0,2}/gi, "Bearer <redacted>"],
  [/\bsk-[A-Za-z0-9_-]{8,}/g, "<redacted-key>"],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, "<redacted-key>"],
  [/\bxox[baprs]-[A-Za-z0-9-]{8,}/g, "<redacted-key>"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "<redacted-key>"],
  // The leading [A-Za-z0-9_]* matters: \b would not match inside ANTHROPIC_TOKEN or
  // MY_API_KEY, which is exactly how these arrive from env-var names.
  [
    /([A-Za-z0-9_]*(?:api[_-]?key|apikey|token|secret|passwd|password|authorization|credential))(["']?\s*[:=]\s*["']?)([^\s"',;)}]{3,})/gi,
    "$1$2<redacted>",
  ],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>"],
  // Catch-all for opaque credentials no named pattern above knows about. 32 is above
  // any realistic identifier in a stack frame and below nanoid(32)-style tokens.
  [/\b[A-Za-z0-9_-]{32,}\b/g, "<redacted-token>"],
];

const HOME_PATH_PATTERNS: RegExp[] = [
  /\/(?:Users|home)\/[^/\s:"']+/g,
  /[A-Za-z]:\\Users\\[^\\\s:"']+/g,
];

/**
 * Error messages quote the data that caused them. A JSON.parse failure prints the
 * payload, a validation error prints the rejected value, a driver error prints the row.
 * None of that is a credential, so the patterns above miss all of it.
 *
 * The line drawn here is double quotes get redacted and single quotes do not. JSON and
 * printed data use double quotes; JavaScript error messages use single quotes for
 * identifiers ("Cannot find module 'x'", "property 'y' of undefined"), which stay
 * readable. It costs some detail on double-quoted identifiers, and that is the trade.
 */
function redactQuotedPayloads(value: string): string {
  let out = value.replace(/"[^"\n]*"/g, '"<redacted>"');

  // Braces and brackets in an error message are a printed data structure, not prose.
  // Looped because the inner-most match has to collapse before the one wrapping it.
  // ponytail: four passes, so nesting deeper than that collapses only partially.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = out
      .replace(/\{[^{}]*\}/g, "<redacted>")
      .replace(/\[[^[\]]*\]/g, "<redacted>");

    if (next === out) {
      break;
    }

    out = next;
  }

  return out;
}

export function scrubText(value: string): string {
  if (!value) {
    return "";
  }

  let out = value;
  const home = homedir();

  if (home && home !== "/") {
    out = out.split(home).join("~");
  }

  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }

  for (const pattern of HOME_PATH_PATTERNS) {
    out = out.replace(pattern, "~");
  }

  out = redactQuotedPayloads(out);

  return out.length > MAX_TEXT_LENGTH
    ? `${out.slice(0, MAX_TEXT_LENGTH)}…`
    : out;
}
