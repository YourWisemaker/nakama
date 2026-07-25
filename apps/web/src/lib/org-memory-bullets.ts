/**
 * Parse the `## Pinned` bullets out of an org memory file's raw content.
 * Used by the org memory dashboard to render the pinned-fact list.
 */
export function parsePinnedBullets(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const bullets: string[] = [];
  let inPinned = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("#")) {
      inPinned = /^##\s*Pinned/i.test(trimmed);
      continue;
    }
    if (inPinned && trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2).trim());
    }
  }
  return bullets;
}

export type OrgMemorySection = {
  title: string;
  bullets: string[];
  text: string[];
};

/**
 * Parse an org memory file into its `## Section` groups.
 * The leading `# Org Memory` H1 is treated as a redundant document title and skipped.
 * Each `## Title` starts a new section; `- ` lines become bullets, other non-empty lines become text.
 */
export function parseOrgMemorySections(content: string): OrgMemorySection[] {
  const sections: OrgMemorySection[] = [];
  let current: OrgMemorySection | null = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (/^#\s+/.test(line) && !/^##\s+/.test(line)) {
      // H1 document title — skip (the card already shows "Org Memory").
      continue;
    }
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = { title: line.replace(/^##\s+/, "").trim(), bullets: [], text: [] };
      continue;
    }
    if (!current) {
      current = { title: "", bullets: [], text: [] };
    }
    if (line.startsWith("- ")) {
      current.bullets.push(line.slice(2).trim());
    } else {
      current.text.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}
