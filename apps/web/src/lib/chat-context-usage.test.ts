import { describe, expect, test } from "bun:test";
import type { ChatListItem } from "@/lib/chat-history";
import {
  buildChatContextUsage,
  contextUsageRatio,
  estimateChatListTokens,
  formatContextUsageLabel,
  formatTokenCount,
} from "./chat-context-usage";

function item(partial: Partial<ChatListItem> & Pick<ChatListItem, "id" | "role">): ChatListItem {
  return {
    content: "",
    ...partial,
  };
}

describe("estimateChatListTokens", () => {
  test("estimates from message text at ~4 chars per token", () => {
    expect(
      estimateChatListTokens([
        item({ id: "1", role: "user", content: "abcd" }),
        item({ id: "2", role: "assistant", content: "efghijkl" }),
      ]),
    ).toBe(3);
  });

  test("includes thinking and tool payloads", () => {
    const tokens = estimateChatListTokens([
      item({
        id: "1",
        role: "assistant",
        content: "abcd",
        thinking: "efgh",
        toolInput: { path: "ab" },
      }),
    ]);

    expect(tokens).toBeGreaterThan(2);
  });
});

describe("buildChatContextUsage", () => {
  test("returns null without a positive context window", () => {
    expect(buildChatContextUsage([], undefined)).toBeNull();
    expect(buildChatContextUsage([], 0)).toBeNull();
  });

  test("returns used tokens against the window", () => {
    expect(
      buildChatContextUsage(
        [item({ id: "1", role: "user", content: "abcdabcd" })],
        100,
      ),
    ).toEqual({ usedTokens: 2, contextWindow: 100 });
  });
});

describe("contextUsageRatio", () => {
  test("clamps between 0 and 1", () => {
    expect(contextUsageRatio({ usedTokens: 25, contextWindow: 100 })).toBe(0.25);
    expect(contextUsageRatio({ usedTokens: 200, contextWindow: 100 })).toBe(1);
    expect(contextUsageRatio({ usedTokens: -5, contextWindow: 100 })).toBe(0);
  });
});

describe("formatTokenCount", () => {
  test("formats compact counts", () => {
    expect(formatTokenCount(42)).toBe("42");
    expect(formatTokenCount(1_500)).toBe("1.5k");
    expect(formatTokenCount(12_400)).toBe("12k");
    expect(formatTokenCount(1_200_000)).toBe("1.2M");
  });
});

describe("formatContextUsageLabel", () => {
  test("includes percent and token counts", () => {
    expect(
      formatContextUsageLabel({ usedTokens: 25_000, contextWindow: 100_000 }),
    ).toBe("Context 25% · ~25k / 100k");
  });
});
