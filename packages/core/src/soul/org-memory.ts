/**
 * Pure parse/summary helpers for org `MEMORY.md`.
 *
 * No disk I/O lives here — callers hand in the file content and write the
 * rebuilt string back out themselves. This keeps the helpers trivially
 * testable and lets the service layer own all filesystem access.
 */

import type { MemorySection } from "./memory-archive";

export const ORG_MEMORY_PREAMBLE = `## Org Memory

## Pinned`;

export interface ParsedOrgMemory {
  preamble: string;
  pinned: string[];
  sections: MemorySection[];
}

export function normalizeOrgMemoryDedupKey(bullet: string): string {
  return bullet.trim().replace(/^-\s+/, "").trim().toLowerCase();
}

export function detectOrgMemoryInjectionWarnings(bullet: string): string[] {
  const warnings: string[] = [];
  if (/ignore (all )?previous/i.test(bullet)) {
    warnings.push("Contains instruction-like phrasing.");
  }
  if (/^system:/im.test(bullet)) {
    warnings.push("Contains a system-style prefix.");
  }
  if (/^##\s/m.test(bullet)) {
    warnings.push("Contains markdown headings.");
  }
  if (/<\/?[a-z][\s\S]*>/i.test(bullet)) {
    warnings.push("Contains HTML-like markup.");
  }
  return warnings;
}

export function parseOrgMemoryContent(content: string): ParsedOrgMemory {
  const lines = content.split("\n");
  const preambleLines: string[] = [];
  const pinned: string[] = [];
  const sections: MemorySection[] = [];
  let phase: "preamble" | "pinned" | "dated" = "preamble";
  let currentDate: string | null = null;
  let currentBullets: string[] = [];

  const flushSection = () => {
    if (currentDate) {
      sections.push({ date: currentDate, bullets: currentBullets });
    }
    currentDate = null;
    currentBullets = [];
  };

  for (const line of lines) {
    if (line.match(/^## Pinned$/)) {
      if (phase === "dated") {
        flushSection();
      }
      phase = "pinned";
      continue;
    }

    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      if (phase === "dated") {
        flushSection();
      }
      phase = "dated";
      currentDate = dateMatch[1];
      currentBullets = [];
      continue;
    }

    if (phase === "preamble") {
      preambleLines.push(line);
      continue;
    }

    if (line.startsWith("- ")) {
      if (phase === "pinned") {
        pinned.push(line.slice(2));
      } else if (phase === "dated") {
        currentBullets.push(line.slice(2));
      }
    }
  }

  if (phase === "dated") {
    flushSection();
  }

  return {
    preamble: preambleLines.join("\n").replace(/\n+$/, ""),
    pinned,
    sections,
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

  for (const section of parsed.sections) {
    if (section.bullets.length === 0) {
      continue;
    }
    parts.push("", `## ${section.date}`, "");
    for (const bullet of section.bullets) {
      parts.push(`- ${bullet}`);
    }
  }

  const content = parts.join("\n").replace(/\n+$/, "");
  return content.length > 0 ? `${content}\n` : content;
}

export function collectRecentLogBullets(
  sections: MemorySection[],
  limit: number,
): string[] {
  if (limit <= 0) {
    return [];
  }

  const sorted = [...sections].sort((a, b) => b.date.localeCompare(a.date));
  const collected: string[] = [];

  for (const section of sorted) {
    for (let index = section.bullets.length - 1; index >= 0; index -= 1) {
      collected.push(section.bullets[index]);
      if (collected.length >= limit) {
        return collected;
      }
    }
  }

  return collected;
}

export interface OrgMemorySummaryOptions {
  /** Hard byte cap on the rendered summary. Defaults to 2048. */
  byteCap?: number;
  /** Most recent log bullets to include after pinned. Defaults to 20. */
  recentLogLimit?: number;
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
 * prompt. Includes pinned bullets first, then the N most recent log bullets.
 * When the rendered section exceeds `byteCap`, bullets are dropped from the
 * end and an overflow hint is appended pointing the agent at
 * `org_memory_search`.
 */
export function composeOrgMemorySummary(
  content: string,
  options: OrgMemorySummaryOptions = {},
): string {
  const {
    byteCap = 2048,
    recentLogLimit = 20,
    overflowHint = "Use the org_memory_search tool for the full history.",
  } = options;
  const parsed = parseOrgMemoryContent(content);
  const recentBullets = collectRecentLogBullets(parsed.sections, recentLogLimit);
  const bullets = [...parsed.pinned, ...recentBullets];

  if (bullets.length === 0) {
    return "";
  }

  const header = "## Org Memory";
  const lines: string[] = [header, ""];

  let bytes = Buffer.byteLength(lines.join("\n") + "\n", "utf8");
  let included = 0;

  for (const bullet of bullets) {
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
    return `${header}\n\n- ${overflowHint}\n`;
  }

  if (included < bullets.length) {
    lines.push("", `- ${overflowHint}`);
  }

  return lines.join("\n");
}
