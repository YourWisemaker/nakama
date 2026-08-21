import { dirname, join } from "node:path";
import { getDiscordConfigDir } from "@nakama/core/discord-config";
import { readTextOrNull, writeTextFile } from "@nakama/core/fs";

/** Persisted ownership of Discord threads the bot started. */
export class ThreadStore {
  private readonly path: string;
  private owned = new Set<string>();

  constructor(path = getThreadMapPath()) {
    this.path = path;
  }

  async load(): Promise<void> {
    const raw = await readTextOrNull(this.path);

    if (raw === null) {
      this.owned = new Set();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      this.owned = new Set();
      return;
    }

    const next = new Set<string>();

    if (Array.isArray(parsed)) {
      for (const value of parsed) {
        if (typeof value === "string" && value.trim()) {
          next.add(value.trim());
        }
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      // Legacy shape: { "threadId": "threadId" } or old key→threadId maps.
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) {
          next.add(value.trim());
        }
      }
    }

    this.owned = next;
  }

  add(threadId: string): void {
    const id = threadId.trim();
    if (!id) {
      return;
    }
    this.owned.add(id);
  }

  hasThreadId(threadId: string): boolean {
    return this.owned.has(threadId);
  }

  deleteByThreadId(threadId: string): boolean {
    return this.owned.delete(threadId);
  }

  async save(): Promise<void> {
    await writeTextFile(
      this.path,
      `${JSON.stringify([...this.owned], null, 2)}\n`,
      { ensureDir: dirname(this.path) }
    );
  }
}

function getThreadMapPath(): string {
  return join(getDiscordConfigDir(), "chat-threads.json");
}
