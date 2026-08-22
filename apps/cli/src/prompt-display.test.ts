import { describe, expect, test } from "bun:test";
import { normalizePastedText, splitInputDisplayLines } from "./prompt-display";

describe("normalizePastedText", () => {
  test("normalizes CR and CRLF to LF", () => {
    expect(normalizePastedText("a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("splitInputDisplayLines", () => {
  test("wraps by remaining width after prefix", () => {
    expect(splitInputDisplayLines("abcdefgh", 2, 5)).toEqual([
      "abc",
      "def",
      "gh",
    ]);
  });

  test("preserves explicit newlines", () => {
    expect(splitInputDisplayLines("ab\ncd", 0, 10)).toEqual(["ab", "cd"]);
  });
});
