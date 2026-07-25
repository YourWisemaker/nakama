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
