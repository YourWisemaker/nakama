import { afterEach, describe, expect, test } from "bun:test";
import {
  appendOrgMemorySection,
  composeOrgMemorySummary,
  ORG_MEMORY_PREAMBLE,
  parseOrgMemoryContent,
  rebuildOrgMemoryContent,
} from "./org-memory";

describe("org memory parse/rebuild", () => {
  test("parses a pinned-only MEMORY.md", () => {
    const content = `${ORG_MEMORY_PREAMBLE}\n\n- deploys ship on Tuesdays\n- prefer Bun over Node\n`;
    const parsed = parseOrgMemoryContent(content);
    expect(parsed.preamble).toBe("# Org Memory");
    expect(parsed.pinned).toEqual(["deploys ship on Tuesdays", "prefer Bun over Node"]);
  });

  test("round-trips parse -> rebuild -> equal", () => {
    const content = `${ORG_MEMORY_PREAMBLE}\n\n- deploys ship on Tuesdays\n- prefer Bun over Node\n`;
    const rebuilt = rebuildOrgMemoryContent(parseOrgMemoryContent(content));
    expect(rebuilt).toBe(content);
  });

  test("rebuild adds the preamble when missing", () => {
    const rebuilt = rebuildOrgMemoryContent({ preamble: "", pinned: ["a fact"] });
    expect(rebuilt).toBe(`${ORG_MEMORY_PREAMBLE}\n\n## Pinned\n\n- a fact\n`);
  });

  test("empty/missing MEMORY.md yields empty summary (no throw)", () => {
    expect(composeOrgMemorySummary("")).toBe("");
    expect(composeOrgMemorySummary(ORG_MEMORY_PREAMBLE)).toBe("");
  });

  test("ignores v2 dated sections for v1 summary", () => {
    const content = `${ORG_MEMORY_PREAMBLE}\n\n- pinned fact\n\n## 2026-07-25\n\n- dated fact\n`;
    const parsed = parseOrgMemoryContent(content);
    expect(parsed.pinned).toEqual(["pinned fact"]);
    expect(composeOrgMemorySummary(content)).toContain("- pinned fact");
    expect(composeOrgMemorySummary(content)).not.toContain("- dated fact");
  });
});

describe("composeOrgMemorySummary", () => {
  test("returns header + pinned bullets", () => {
    const content = `${ORG_MEMORY_PREAMBLE}\n\n- fact one\n- fact two\n`;
    const summary = composeOrgMemorySummary(content);
    expect(summary).toContain("# Org Memory");
    expect(summary).toContain("- fact one");
    expect(summary).toContain("- fact two");
  });

  test("truncates at byte cap and appends overflow hint", () => {
    const bullets = Array.from({ length: 50 }, (_, i) => `fact number ${i} with some text`);
    const content = `${ORG_MEMORY_PREAMBLE}\n\n${bullets.map((b) => `- ${b}`).join("\n")}\n`;
    const summary = composeOrgMemorySummary(content, { byteCap: 256 });
    expect(Buffer.byteLength(summary, "utf8")).toBeLessThanOrEqual(512);
    expect(summary).toContain("org_memory_search");
    // Not all bullets fit
    expect(summary).not.toContain("fact number 49");
  });

  test("emits header + hint when even one bullet exceeds the cap", () => {
    const huge = "x".repeat(3000);
    const content = `${ORG_MEMORY_PREAMBLE}\n\n- ${huge}\n`;
    const summary = composeOrgMemorySummary(content, { byteCap: 256 });
    expect(summary).toContain("# Org Memory");
    expect(summary).toContain("org_memory_search");
    expect(summary).not.toContain(huge);
  });
});

describe("appendOrgMemorySection", () => {
  const base = "# Identity\n\nYou are helpful.";

  test("appends the summary for a member", () => {
    const summary = "# Org Memory\n\n- fact one";
    expect(appendOrgMemorySection(base, summary, "member")).toBe(
      `${base}\n\n${summary}`,
    );
  });

  test("appends the summary for an admin", () => {
    const summary = "# Org Memory\n\n- fact one";
    expect(appendOrgMemorySection(base, summary, "admin")).toBe(
      `${base}\n\n${summary}`,
    );
  });

  test("appends the summary when orgRole is undefined (system runners)", () => {
    const summary = "# Org Memory\n\n- fact one";
    expect(appendOrgMemorySection(base, summary, undefined)).toBe(
      `${base}\n\n${summary}`,
    );
  });

  test("does NOT append for a viewer", () => {
    const summary = "# Org Memory\n\n- secret fact";
    expect(appendOrgMemorySection(base, summary, "viewer")).toBe(base);
  });

  test("does not append an empty summary (no empty header)", () => {
    expect(appendOrgMemorySection(base, "", "member")).toBe(base);
    expect(appendOrgMemorySection(base, "   \n  ", "member")).toBe(base);
  });
});
