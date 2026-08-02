import {
  TOKENS_PER_DOCUMENT_ESTIMATE,
  TOKENS_PER_IMAGE_ESTIMATE,
} from "@nakama/core/message-content";
import type { ChatListItem } from "@/lib/chat-history";

const TOKEN_ESTIMATE_RATIO = 4;

export type ChatContextUsage = {
  usedTokens: number;
  contextWindow: number;
};

function estimateTextTokens(text: string | undefined): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / TOKEN_ESTIMATE_RATIO);
}

/** Rough prompt-size estimate from visible chat list items (excludes system/tools). */
export function estimateChatListTokens(messages: readonly ChatListItem[]): number {
  let total = 0;

  for (const message of messages) {
    total += estimateTextTokens(message.content);
    total += estimateTextTokens(message.thinking);

    if (message.images?.length) {
      total += message.images.length * TOKENS_PER_IMAGE_ESTIMATE;
    } else if (message.imageAttachments?.length) {
      total += message.imageAttachments.length * TOKENS_PER_IMAGE_ESTIMATE;
    }

    if (message.documents?.length) {
      total += message.documents.length * TOKENS_PER_DOCUMENT_ESTIMATE;
    }

    if (message.toolInput) {
      total += estimateTextTokens(JSON.stringify(message.toolInput));
    } else if (message.toolInputAccumulatedJson) {
      total += estimateTextTokens(message.toolInputAccumulatedJson);
    }

    if (message.toolResult != null) {
      total += estimateTextTokens(
        typeof message.toolResult === "string"
          ? message.toolResult
          : JSON.stringify(message.toolResult),
      );
    }
  }

  return total;
}

export function buildChatContextUsage(
  messages: readonly ChatListItem[],
  contextWindow: number | undefined,
): ChatContextUsage | null {
  if (!contextWindow || contextWindow <= 0) {
    return null;
  }

  return {
    usedTokens: estimateChatListTokens(messages),
    contextWindow,
  };
}

export function contextUsageRatio(usage: ChatContextUsage): number {
  if (usage.contextWindow <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, usage.usedTokens / usage.contextWindow));
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) {
    return String(Math.max(0, Math.round(tokens)));
  }

  if (tokens < 10_000) {
    return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }

  if (tokens < 1_000_000) {
    return `${Math.round(tokens / 1_000)}k`;
  }

  return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function formatContextUsageLabel(usage: ChatContextUsage): string {
  const percent = Math.round(contextUsageRatio(usage) * 100);
  return `Context ${percent}% · ~${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.contextWindow)}`;
}
