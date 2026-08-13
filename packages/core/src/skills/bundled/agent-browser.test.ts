import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchSkillsForMessage } from "../match";
import { parseSkillMarkdown } from "../parse";
import { readBundledSkillMarkdown } from "./index";
import { ensureBundledSkillFiles } from "./install";

describe("bundled agent-browser skill", () => {
  test("description matches interactive browse requests but not plain fetch or explainers", async () => {
    const content = await readBundledSkillMarkdown("agent-browser");
    const parsed = parseSkillMarkdown(content, "agent-browser/SKILL.md");
    const discovered = {
      body: parsed.body,
      description: parsed.frontmatter.description,
      directory: "/tmp/agent-browser",
      disableModelInvocation: false,
      hasTool: false,
      includeBodyOnMatch: true,
      name: parsed.frontmatter.name,
      skillFilePath: "/tmp/agent-browser/SKILL.md",
      toolPath: null,
    };

    expect(
      matchSkillsForMessage(
        [discovered],
        "Open our login-walled vendor portal in the browser and check order status"
      ).map((skill) => skill.name)
    ).toEqual(["agent-browser"]);

    expect(
      matchSkillsForMessage(
        [discovered],
        "Explain how TLS session resumption works"
      ).map((skill) => skill.name)
    ).toEqual([]);

    expect(
      matchSkillsForMessage(
        [discovered],
        "Fetch https://example.com and summarize the homepage"
      ).map((skill) => skill.name)
    ).toEqual([]);

    expect(
      matchSkillsForMessage(
        [discovered],
        "Research the competitors and summarize findings"
      ).map((skill) => skill.name)
    ).toEqual([]);

    expect(
      matchSkillsForMessage([discovered], "How do React forms work?").map(
        (skill) => skill.name
      )
    ).toEqual([]);

    expect(
      matchSkillsForMessage([discovered], "Fix the login page copy").map(
        (skill) => skill.name
      )
    ).toEqual([]);

    expect(
      matchSkillsForMessage(
        [discovered],
        "Drive the migration plan forward"
      ).map((skill) => skill.name)
    ).toEqual([]);
  });
});

describe("ensureBundledSkillFiles for agent-browser", () => {
  let configDir: string;

  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), "nakama-agent-browser-skills-"));
    process.env.NAKAMA_CONFIG_DIR = configDir;
    await mkdir(join(configDir, "agent", "skills"), { recursive: true });
  });

  afterEach(() => {
    delete process.env.NAKAMA_CONFIG_DIR;
  });

  test("writes agent-browser when missing", async () => {
    const created = await ensureBundledSkillFiles();
    expect(created).toContain("agent-browser");
  });
});
