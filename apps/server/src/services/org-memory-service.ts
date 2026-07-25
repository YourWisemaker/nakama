import { join } from "node:path";
import {
  NakamaApiError,
  ORG_MEMORY_PREAMBLE,
  composeOrgMemorySummary,
  getOrgMemoryArchiveDir,
  getOrgMemoryDir,
  getOrgMemoryFilePath,
  parseOrgMemoryContent,
  rebuildOrgMemoryContent,
} from "@nakama/core";
import {
  pathExists,
  readDirectoryEntries,
  readText,
  readTextIfExists,
  writePrivateTextFile,
} from "@nakama/core/fs";

const SUMMARY_BYTE_CAP = 2048;

export interface OrgMemoryContent {
  content: string;
}

export interface OrgMemorySearchMatch {
  source: "live" | string;
  bullet: string;
}

export interface OrgMemorySearchResult {
  query: string;
  matches: OrgMemorySearchMatch[];
}

export class OrgMemoryService {
  /**
   * Read the live org MEMORY.md. Returns the canonical preamble when the file
   * does not yet exist (so callers always get a usable string).
   */
  async getMemory(orgId: string): Promise<string> {
    const existing = await readTextIfExists(getOrgMemoryFilePath(orgId));
    return existing ?? `${ORG_MEMORY_PREAMBLE}\n`;
  }

  /** Render the `# Org Memory` section injected into profile system prompts. */
  async getSummary(orgId: string): Promise<string> {
    const content = await this.getMemory(orgId);
    return composeOrgMemorySummary(content, { byteCap: SUMMARY_BYTE_CAP });
  }

  /** Replace the entire live MEMORY.md content (admin only). */
  async setMemory(orgId: string, content: string): Promise<void> {
    const trimmed = content.trim();
    if (Buffer.byteLength(trimmed, "utf8") > SUMMARY_BYTE_CAP * 4) {
      throw new NakamaApiError("Org memory content exceeds the size limit.", 400);
    }
    const normalized = trimmed.length > 0 ? `${trimmed.replace(/\n+$/, "")}\n` : `${ORG_MEMORY_PREAMBLE}\n`;
    await writePrivateTextFile(getOrgMemoryFilePath(orgId), normalized, {
      ensureDir: getOrgMemoryDir(orgId),
    });
  }

  /**
   * Admin direct-create: add a fact to the pinned section. Creates MEMORY.md
   * with the canonical preamble if it is missing. Idempotent — adding a
   * bullet that is already pinned is a no-op.
   */
  async addFact(orgId: string, bullet: string, options: { pin?: boolean } = {}): Promise<void> {
    const text = this.normalizeBullet(bullet);
    const content = await this.getMemory(orgId);
    const parsed = parseOrgMemoryContent(content);

    if (parsed.pinned.some((existing) => existing.trim() === text)) {
      return;
    }

    parsed.pinned.push(text);
    await this.writeMemory(orgId, rebuildOrgMemoryContent(parsed));
  }

  /** Pin an existing bullet (move to pinned if dated, or add). 404 if not found and not adding. */
  async pinFact(orgId: string, bullet: string): Promise<void> {
    const text = this.normalizeBullet(bullet);
    const content = await this.getMemory(orgId);
    const parsed = parseOrgMemoryContent(content);

    if (parsed.pinned.some((existing) => existing.trim() === text)) {
      return; // already pinned
    }
    parsed.pinned.push(text);
    await this.writeMemory(orgId, rebuildOrgMemoryContent(parsed));
  }

  /** Remove a bullet from the pinned section. 404 if it is not pinned. */
  async unpinFact(orgId: string, bullet: string): Promise<void> {
    const text = this.normalizeBullet(bullet);
    const content = await this.getMemory(orgId);
    const parsed = parseOrgMemoryContent(content);

    const index = parsed.pinned.findIndex((existing) => existing.trim() === text);
    if (index === -1) {
      throw new NakamaApiError("Pinned fact not found.", 404);
    }
    parsed.pinned.splice(index, 1);
    await this.writeMemory(orgId, rebuildOrgMemoryContent(parsed));
  }

  /**
   * Archive pinned bullets out of the live file into memory-archive/YYYY-MM.md.
   * Uses the org (pinned-aware) parser rather than the profile dated-section
   * parser, since org memory v1 is pinned-only. Throws if an entry is not
   * pinned or no entries match.
   */
  async archiveEntries(
    orgId: string,
    entries: string[],
    options: { reason?: string; archivedAt?: Date } = {},
  ) {
    const targets = new Set(
      entries.map((e) => e.trim().replace(/^-\s+/, "").trim()).filter(Boolean),
    );
    if (targets.size === 0) {
      throw new NakamaApiError("No memory entries provided.", 400);
    }

    const content = await this.getMemory(orgId);
    const parsed = parseOrgMemoryContent(content);
    const kept: string[] = [];
    const archived: string[] = [];
    const unmatched: string[] = [];

    for (const bullet of parsed.pinned) {
      if (targets.has(bullet.trim())) {
        archived.push(bullet);
      } else {
        kept.push(bullet);
      }
    }
    for (const target of targets) {
      if (!archived.some((b) => b.trim() === target)) {
        unmatched.push(target);
      }
    }
    if (unmatched.length > 0) {
      throw new NakamaApiError(`Memory entries not found: ${unmatched.join(", ")}`, 404);
    }
    if (archived.length === 0) {
      throw new NakamaApiError("No matching memory entries found.", 404);
    }

    const archivedAt = options.archivedAt ?? new Date();
    const yearMonth = `${archivedAt.getFullYear()}-${String(archivedAt.getMonth() + 1).padStart(2, "0")}`;
    const archiveDir = getOrgMemoryArchiveDir(orgId);
    const archivePath = join(archiveDir, `${yearMonth}.md`);
    const appendLines = [
      `<!-- archived: ${archivedAt.toISOString()} -->`,
    ];
    if (options.reason?.trim()) {
      appendLines.push(`<!-- reason: ${options.reason.trim().replace(/-->/g, "")} -->`);
    }
    appendLines.push("", "## Pinned", "");
    for (const bullet of archived) {
      appendLines.push(`- ${bullet}`);
    }
    const append = `${appendLines.join("\n")}\n`;

    const archiveExists = await pathExists(archivePath);
    const archiveContent = archiveExists
      ? `${(await readText(archivePath)).replace(/\n+$/, "")}\n\n${append}`
      : `# Archived Org Memory\n\n---\n\n${append}`;

    const activeContent = rebuildOrgMemoryContent({ preamble: parsed.preamble, pinned: kept });
    await writePrivateTextFile(archivePath, archiveContent, { ensureDir: archiveDir });
    await writePrivateTextFile(getOrgMemoryFilePath(orgId), activeContent, {
      ensureDir: getOrgMemoryDir(orgId),
    });

    return {
      archived: archived.length,
      activeBytes: Buffer.byteLength(activeContent, "utf8"),
      archivePath,
    };
  }

  /** Full-text scan of live MEMORY.md + all archive files. */
  async search(orgId: string, query: string): Promise<OrgMemorySearchResult> {
    const normalizedQuery = query.trim().toLowerCase();
    const matches: OrgMemorySearchMatch[] = [];

    if (normalizedQuery === "") {
      return { query, matches };
    }

    const live = await readTextIfExists(getOrgMemoryFilePath(orgId));
    if (live) {
      for (const bullet of this.collectBullets(live)) {
        if (bullet.toLowerCase().includes(normalizedQuery)) {
          matches.push({ source: "live", bullet });
        }
      }
    }

    const archiveDir = getOrgMemoryArchiveDir(orgId);
    if (await pathExists(archiveDir)) {
      const entries = await readDirectoryEntries(archiveDir);
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => entry.name)
        .sort();
      for (const filename of files) {
        const archiveContent = await readText(join(archiveDir, filename));
        for (const bullet of this.collectBullets(archiveContent)) {
          if (bullet.toLowerCase().includes(normalizedQuery)) {
            matches.push({ source: filename, bullet });
          }
        }
      }
    }

    return { query, matches };
  }

  private collectBullets(content: string): string[] {
    const bullets: string[] = [];
    for (const line of content.split("\n")) {
      if (line.startsWith("- ")) {
        bullets.push(line.slice(2));
      }
    }
    return bullets;
  }

  private normalizeBullet(bullet: string): string {
    const text = bullet.trim().replace(/^-\s+/, "").trim();
    if (text.length === 0) {
      throw new NakamaApiError("Memory bullet must not be empty.", 400);
    }
    return text;
  }

  private async writeMemory(orgId: string, content: string): Promise<void> {
    await writePrivateTextFile(getOrgMemoryFilePath(orgId), content, {
      ensureDir: getOrgMemoryDir(orgId),
    });
  }
}
