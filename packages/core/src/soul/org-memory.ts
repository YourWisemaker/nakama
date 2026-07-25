/**
 * Pure parse/summary helpers for org `MEMORY.md` (v1: pinned-only).
 *
 * No disk I/O lives here — callers hand in the file content and write the
 * rebuilt string back out themselves. This keeps the helpers trivially
 * testable and lets the service layer own all filesystem access.
 */

export const ORG_MEMORY_PREAMBLE = `## Org Memory

## Pinned`;

export interface ParsedOrgMemory {
  preamble: string;
  pinned: string[];
}

export function parseOrgMemoryContent(content: string): ParsedOrgMemory {
  const lines = content.split("\n");
  const preambleLines: string[] = [];
  const pinned: string[] = [];
  let phase: "preamble" | "pinned" = "preamble";

  for (const line of lines) {
    if (line.match(/^## Pinned$/)) {
      phase = "pinned";
      continue;
    }

    // A dated section (## YYYY-MM-DD) belongs to the v2 recent-log tier; for
    // v1 we stop collecting pinned bullets once we hit one and treat the
    // rest as preamble-equivalent (ignored for summary purposes).
    if (line.match(/^## \d{4}-\d{2}-\d{2}$/)) {
      phase = "preamble";
      continue;
    }

    if (phase === "preamble") {
      preambleLines.push(line);
      continue;
    }

    if (line.startsWith("- ")) {
      pinned.push(line.slice(2));
    }
  }

  return {
    preamble: preambleLines.join("\n").replace(/\n+$/, ""),
    pinned,
  };
}

export function rebuildOrgMemoryContent(parsed: ParsedOrgMemory): string {
  const parts: string[] = [];

  const preamble = parsed.preamble.trim();
  if (preamble) {
    parts.push(preamble);
  } else {
    parts.push(ORG_MEMORY_PREAMBLE);
  }

  if (parsed.pinned.length > 0) {
    parts.push("", "## Pinned", "");
    for (const bullet of parsed.pinned) {
      parts.push(`- ${bullet}`);
    }
  }

  const content = parts.join("\n").replace(/\n+$/, "");
  return content.length > 0 ? `${content}\n` : content;
}

export interface OrgMemorySummaryOptions {
  /** Hard byte cap on the rendered summary. Defaults to 2048. */
  byteCap?: number;
  /** Hint shown when the summary is truncated. */
  overflowHint?: string;
}

/**
 * Append the org memory section to a system prompt, gated by org role.
 * Viewers never receive the section; everyone else gets it appended when
 * non-empty. Returns the unchanged `systemPrompt` when the section is empty
 * or the role is viewer.
 */
export function appendOrgMemorySection(
  systemPrompt: string,
  summary: string,
  orgRole?: string | null,
): string {
  if (orgRole === "viewer") {
    return systemPrompt;
  }
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    return systemPrompt;
  }
  return `${systemPrompt.trim()}\n\n${trimmed}`;
}

/**
 * Render the `## Org Memory` section string injected into a profile's system
 * prompt. v1: pinned bullets only. When the rendered section exceeds
 * `byteCap`, bullets are dropped from the end and an overflow hint is appended
 * pointing the agent at the `org_memory_search` tool.
 */
export function composeOrgMemorySummary(
  content: string,
  options: OrgMemorySummaryOptions = {},
): string {
  const { byteCap = 2048, overflowHint = "Use the org_memory_search tool for the full history." } =
    options;
  const parsed = parseOrgMemoryContent(content);

  if (parsed.pinned.length === 0) {
    return "";
  }

  const header = "## Org Memory";
  const lines: string[] = [header, ""];

  let bytes = Buffer.byteLength(lines.join("\n") + "\n", "utf8");
  let included = 0;

  for (const bullet of parsed.pinned) {
    const candidate = `- ${bullet}`;
    const candidateBytes = Buffer.byteLength(candidate + "\n", "utf8");
    if (bytes + candidateBytes > byteCap) {
      break;
    }
    lines.push(candidate);
    bytes += candidateBytes;
    included += 1;
  }

  if (included === 0) {
    // Even one bullet doesn't fit; emit header + hint so the agent knows to
    // use the tool rather than silently dropping everything.
    return `${header}\n\n- ${overflowHint}\n`;
  }

  if (included < parsed.pinned.length) {
    lines.push("", `- ${overflowHint}`);
  }

  return lines.join("\n");
}
