import * as readline from "node:readline/promises";
import type { ImageAttachment } from "@nakama/core";

export class PromptCancelledError extends Error {
  constructor() {
    super("Prompt cancelled");
    this.name = "PromptCancelledError";
  }
}

export interface PromptLineResult {
  images?: ImageAttachment[];
  text: string;
}

/**
 * Non-TTY / pipe fallback. Sticky TTY input is PersistentPrompt.
 * TerminalLayout.apply() only fails when stdin/stdout are not TTY, so the old
 * raw-mode promptLine path was unreachable in production.
 */
export async function promptLine(prefix = "> "): Promise<PromptLineResult> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return { text: (await rl.question(prefix)).trimEnd() };
  } finally {
    rl.close();
  }
}
