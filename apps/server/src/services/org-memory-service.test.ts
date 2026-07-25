import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { ORG_MEMORY_PREAMBLE, parseOrgMemoryContent } from "@nakama/core";
import { OrgMemoryService } from "./org-memory-service";

const originalConfigDir = process.env.NAKAMA_CONFIG_DIR;

describe("OrgMemoryService", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
    if (originalConfigDir === undefined) {
      delete process.env.NAKAMA_CONFIG_DIR;
    } else {
      process.env.NAKAMA_CONFIG_DIR = originalConfigDir;
    }
  });

  async function setup(): Promise<OrgMemoryService> {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "nakama-org-memory-"));
    process.env.NAKAMA_CONFIG_DIR = tempDir;
    return new OrgMemoryService();
  }

  test("getMemory returns the canonical preamble when the file is missing", async () => {
    const service = await setup();
    const content = await service.getMemory("org_a");
    expect(content).toBe(`${ORG_MEMORY_PREAMBLE}\n`);
  });

  test("addFact with pin creates MEMORY.md with preamble + bullet on first action", async () => {
    const service = await setup();
    await service.addFact("org_a", "deploys ship on Tuesdays", { pin: true });
    const content = await service.getMemory("org_a");
    const parsed = parseOrgMemoryContent(content);
    expect(parsed.pinned).toEqual(["deploys ship on Tuesdays"]);
    expect(content).toContain("## Org Memory");
    expect(content).toContain("## Pinned");
  });

  test("addFact is idempotent for an already-pinned bullet", async () => {
    const service = await setup();
    await service.addFact("org_a", "fact one", { pin: true });
    await service.addFact("org_a", "fact one", { pin: true });
    const parsed = parseOrgMemoryContent(await service.getMemory("org_a"));
    expect(parsed.pinned).toEqual(["fact one"]);
  });

  test("getSummary returns the pinned bullets", async () => {
    const service = await setup();
    await service.addFact("org_a", "fact one", { pin: true });
    await service.addFact("org_a", "fact two", { pin: true });
    const summary = await service.getSummary("org_a");
    expect(summary).toContain("## Org Memory");
    expect(summary).toContain("- fact one");
    expect(summary).toContain("- fact two");
  });

  test("unpinFact removes a pinned bullet; 404 when not pinned", async () => {
    const service = await setup();
    await service.addFact("org_a", "fact one", { pin: true });
    await service.unpinFact("org_a", "fact one");
    const parsed = parseOrgMemoryContent(await service.getMemory("org_a"));
    expect(parsed.pinned).toEqual([]);
    await expect(service.unpinFact("org_a", "missing")).rejects.toThrow("Pinned fact not found.");
  });

  test("setMemory replaces live content and rejects oversized bodies", async () => {
    const service = await setup();
    await service.setMemory("org_a", `${ORG_MEMORY_PREAMBLE}\n\n- custom\n`);
    expect(await service.getMemory("org_a")).toContain("- custom");
    const huge = "x".repeat(10_000);
    await expect(service.setMemory("org_a", huge)).rejects.toThrow("size limit");
  });

  test("search finds bullets in the live file and archive files", async () => {
    const service = await setup();
    await service.addFact("org_a", "we use Bun not Node", { pin: true });
    await service.addFact("org_a", "deploys on Tuesday", { pin: true });
    const result = await service.search("org_a", "Bun");
    expect(result.matches.some((m) => m.bullet.includes("Bun"))).toBe(true);
    expect(result.matches.some((m) => m.bullet.includes("Tuesday"))).toBe(false);
  });

  test("archiveEntries moves bullets to memory-archive", async () => {
    const service = await setup();
    await service.addFact("org_a", "stale fact", { pin: true });
    await service.addFact("org_a", "keep fact", { pin: true });
    const result = await service.archiveEntries("org_a", ["stale fact"]);
    expect(result.archived).toBe(1);
    const parsed = parseOrgMemoryContent(await service.getMemory("org_a"));
    expect(parsed.pinned).toEqual(["keep fact"]);
  });

  test("cross-org isolation: addFact to org_a only writes org_a's dir", async () => {
    const service = await setup();
    await service.addFact("org_a", "org a fact", { pin: true });
    const orgB = await service.getMemory("org_b");
    expect(orgB).toBe(`${ORG_MEMORY_PREAMBLE}\n`);
    const orgA = parseOrgMemoryContent(await service.getMemory("org_a"));
    expect(orgA.pinned).toEqual(["org a fact"]);
  });
});
