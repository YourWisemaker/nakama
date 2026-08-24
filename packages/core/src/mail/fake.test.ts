import { describe, expect, test } from "bun:test";
import { sanitizeMailError } from "./sanitize";

describe("sanitizeMailError", () => {
  test("redacts password-like content", () => {
    expect(sanitizeMailError(new Error("AUTH failed password=abcd1234"))).toBe(
      "AUTH failed password=[REDACTED]"
    );
  });
});
