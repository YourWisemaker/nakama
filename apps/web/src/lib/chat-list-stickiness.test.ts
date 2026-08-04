import { describe, expect, test } from "bun:test";
import {
  followOutputBehavior,
  shouldAutoscrollOnHeightGrowth,
} from "./chat-list-stickiness";

describe("followOutputBehavior", () => {
  test("follows with auto when at bottom", () => {
    expect(followOutputBehavior(true)).toBe("auto");
  });

  test("does not follow when not at bottom", () => {
    expect(followOutputBehavior(false)).toBe(false);
  });
});

describe("shouldAutoscrollOnHeightGrowth", () => {
  test("autoscrolls only when at bottom", () => {
    expect(shouldAutoscrollOnHeightGrowth(true)).toBe(true);
    expect(shouldAutoscrollOnHeightGrowth(false)).toBe(false);
  });
});
