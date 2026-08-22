import type { DiscordMessenger } from "./messenger";

/** Best-effort Discord message that sends once, then edits in place. */
export class DiscordEditableMessage {
  private messageId: string | null = null;
  private lastRendered = "";
  private pending = Promise.resolve();

  constructor(private readonly messenger: DiscordMessenger) {}

  async render(next: string): Promise<void> {
    this.pending = this.pending.then(() => this.apply(next));
    await this.pending;
  }

  private async apply(next: string): Promise<void> {
    if (next === this.lastRendered) {
      return;
    }

    try {
      if (this.messageId === null) {
        const message = await this.messenger.send(next);
        this.messageId = message?.id ?? null;
      } else {
        await this.messenger.edit(this.messageId, next);
      }

      this.lastRendered = next;
    } catch {
      // Status / questionnaire updates are best-effort only.
    }
  }
}
