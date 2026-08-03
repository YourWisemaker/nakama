import { describe, expect, test } from "bun:test";
import {
  buildAutoEnableThinkingPayload,
  formatThinkingEffortSuccessMessage,
  shouldAutoEnableThinking,
  shouldBlockThinkingEffortChange,
  shouldShowThinkingBlocks,
  shouldShowThinkingEffort,
  thinkingEffortLabel,
} from "./thinking-settings";

describe("thinking-settings helpers", () => {
  test("shouldShowThinkingEffort is true only when model explicitly supports thinking", () => {
    expect(shouldShowThinkingEffort(true)).toBe(true);
    expect(shouldShowThinkingEffort(false)).toBe(false);
    expect(shouldShowThinkingEffort(undefined)).toBe(false);
  });

  test("shouldShowThinkingBlocks matches effort visibility gate", () => {
    expect(shouldShowThinkingBlocks).toBe(shouldShowThinkingEffort);
    expect(shouldShowThinkingBlocks(true)).toBe(true);
    expect(shouldShowThinkingBlocks(undefined)).toBe(false);
  });

  test("buildAutoEnableThinkingPayload always enables thinking", () => {
    expect(buildAutoEnableThinkingPayload({ effort: "high" })).toEqual({
      enabled: true,
      effort: "high",
    });
    expect(buildAutoEnableThinkingPayload({ effort: "medium" })).toEqual({
      enabled: true,
      effort: "medium",
    });
  });

  test("shouldAutoEnableThinking respects guards", () => {
    const disabled = { enabled: false, effort: "low" as const };

    expect(shouldAutoEnableThinking(disabled, true, false, false)).toBe(true);
    expect(shouldAutoEnableThinking(disabled, true, true, false)).toBe(false);
    expect(shouldAutoEnableThinking(disabled, false, false, false)).toBe(false);
    expect(shouldAutoEnableThinking(disabled, true, false, true)).toBe(false);
    expect(shouldAutoEnableThinking({ enabled: true, effort: "low" }, true, false, false)).toBe(
      false,
    );
    expect(
      shouldAutoEnableThinking(disabled, true, false, false, { hasRouteSession: true }),
    ).toBe(false);
    expect(
      shouldAutoEnableThinking(disabled, true, false, false, { hasMessages: true }),
    ).toBe(false);
    expect(
      shouldAutoEnableThinking(disabled, true, false, false, { hasProfileId: false }),
    ).toBe(false);
  });

  test("formatThinkingEffortSuccessMessage flags cleared history without asserting copy", () => {
    expect(formatThinkingEffortSuccessMessage("high", true)).toMatchObject({
      effort: "high",
      clearedHistory: true,
    });
    expect(formatThinkingEffortSuccessMessage("low", false)).toMatchObject({
      effort: "low",
      clearedHistory: false,
    });
    expect(formatThinkingEffortSuccessMessage("high", true).message.length).toBeGreaterThan(0);
  });

  test("shouldBlockThinkingEffortChange blocks while busy", () => {
    expect(shouldBlockThinkingEffortChange(true)).toBe(true);
    expect(shouldBlockThinkingEffortChange(false)).toBe(false);
  });

  test("thinkingEffortLabel maps effort values", () => {
    expect(thinkingEffortLabel("medium")).toBe("Medium");
  });
});
