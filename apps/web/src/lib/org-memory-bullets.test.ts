import { describe, expect, test } from "bun:test";
import { parseOrgMemorySections, parsePinnedBullets } from "./org-memory-bullets";

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

describe("parseOrgMemorySections", () => {
  test("returns empty for blank content", () => {
    expect(parseOrgMemorySections("")).toEqual([]);
  });

  test("skips the H1 title and groups sections", () => {
    const content = [
      "# Org Memory",
      "",
      "## Pinned",
      "- First fact",
      "- Second fact",
      "",
      "## Notes",
      "- not pinned",
      "free text line",
    ].join("\n");
    expect(parseOrgMemorySections(content)).toEqual([
      { title: "Pinned", bullets: ["First fact", "Second fact"], text: [] },
      { title: "Notes", bullets: ["not pinned"], text: ["free text line"] },
    ]);
  });

  test("collects loose bullets before any section into an untitled section", () => {
    const content = "# Org Memory\n- loose bullet\n## Pinned\n- pinned only";
    expect(parseOrgMemorySections(content)).toEqual([
      { title: "", bullets: ["loose bullet"], text: [] },
      { title: "Pinned", bullets: ["pinned only"], text: [] },
    ]);
  });

  test("handles CRLF line endings", () => {
    const content = "# Org Memory\r\n\r\n## Pinned\r\n- crlf fact\r\n";
    expect(parseOrgMemorySections(content)).toEqual([
      { title: "Pinned", bullets: ["crlf fact"], text: [] },
    ]);
  });
});
