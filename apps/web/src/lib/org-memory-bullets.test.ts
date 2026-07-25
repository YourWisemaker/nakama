import { describe, expect, test } from "bun:test";
import { parsePinnedBullets } from "./org-memory-bullets";

describe("parsePinnedBullets", () => {
  test("returns empty for blank content", () => {
    expect(parsePinnedBullets("")).toEqual([]);
  });

  test("collects bullets under the ## Pinned section", () => {
    const content = [
      "# Org Memory",
      "",
      "## Pinned",
      "- First fact",
      "- Second fact",
      "",
      "## Notes",
      "- not pinned",
    ].join("\n");
    expect(parsePinnedBullets(content)).toEqual(["First fact", "Second fact"]);
  });

  test("ignores bullets outside the pinned section", () => {
    const content = ["# Org Memory", "- loose bullet", "## Pinned", "- pinned only"].join("\n");
    expect(parsePinnedBullets(content)).toEqual(["pinned only"]);
  });

  test("handles CRLF line endings", () => {
    const content = "# Org Memory\r\n\r\n## Pinned\r\n- crlf fact\r\n";
    expect(parsePinnedBullets(content)).toEqual(["crlf fact"]);
  });

  test("is case-insensitive on the Pinned header", () => {
    const content = "# Org Memory\n\n## pinned\n- lower\n";
    expect(parsePinnedBullets(content)).toEqual(["lower"]);
  });
});
