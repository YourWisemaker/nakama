import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getOrgCuratorLogDir,
  pathExists,
  SKILL_ARCHIVE_DIR_NAME,
} from "@nakama/core";
import {
  createInMemoryDatabaseAdapter,
  type DatabaseAdapter,
  seedOrgDefaultProfile,
} from "@nakama/db";
import { SkillCuratorService } from "./skill-curator-service";
import { SkillsService } from "./skills-service";

const ORG_ID = "org_curator";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("SkillCuratorService", () => {
  let configDir: string;
  let db: DatabaseAdapter;
  let profileId: string;
  let skillsService: SkillsService;
  let curator: SkillCuratorService;

  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), "nakama-curator-"));
    process.env.NAKAMA_CONFIG_DIR = configDir;
    db = createInMemoryDatabaseAdapter();
    const profile = await seedOrgDefaultProfile(db, ORG_ID);
    profileId = profile.id;
    skillsService = new SkillsService(db);
    curator = new SkillCuratorService(db, skillsService);
  });

  afterEach(async () => {
    delete process.env.NAKAMA_CONFIG_DIR;
    await rm(configDir, { force: true, recursive: true });
  });

  async function addAssignedSkill(input: {
    name: string;
    createdBy: "agent" | "human" | "bundled";
    createdAt: string;
    lastUsedAt?: string | null;
    sourcePath?: string;
  }): Promise<string> {
    const skillId = `skill_${input.name}`;
    const sourcePath =
      input.sourcePath ??
      join(
        configDir,
        "orgs",
        ORG_ID,
        "profiles",
        profileId,
        "skills",
        input.name
      );
    await mkdir(sourcePath, { recursive: true });
    await writeFile(
      join(sourcePath, "SKILL.md"),
      `---\nname: ${input.name}\ndescription: Test.\n---\n\nKeep this.\n`
    );
    await db.upsertSkill({
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      description: "Test.",
      disableModelInvocation: false,
      enabled: true,
      hasTool: false,
      id: skillId,
      name: input.name,
      orgId: ORG_ID,
      sourcePath,
      updatedAt: input.createdAt,
    });
    await db.assignSkillToProfile(profileId, skillId);

    if (input.lastUsedAt) {
      await db.incrementSkillUsage({
        orgId: ORG_ID,
        profileId,
        skillId,
        useDelta: 1,
        usedAt: input.lastUsedAt,
      });
    }

    return skillId;
  }

  test("archives a 95-day unused agent skill and unassigns it", async () => {
    const skillId = await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "agent",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "old-playbook",
    });
    const liveDir = join(
      configDir,
      "orgs",
      ORG_ID,
      "profiles",
      profileId,
      "skills",
      "old-playbook"
    );

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.status).toBe("completed");
    expect(result.archived).toBe(1);
    expect(await pathExists(liveDir)).toBe(false);
    expect(
      await pathExists(
        join(
          configDir,
          "orgs",
          ORG_ID,
          "profiles",
          profileId,
          "skills",
          SKILL_ARCHIVE_DIR_NAME,
          "old-playbook",
          "SKILL.md"
        )
      )
    ).toBe(true);
    expect(await db.listSkillsForProfile(profileId)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: skillId })])
    );
    const stored = await db.getSkill(skillId);
    expect(stored?.sourcePath).toContain(
      `${SKILL_ARCHIVE_DIR_NAME}/old-playbook`
    );
    const report = await readFile(
      join(getOrgCuratorLogDir(ORG_ID), "run.json"),
      "utf8"
    );
    expect(JSON.parse(report).archived).toBe(1);
  });

  test("lists a 40-day unused skill as stale without moving it", async () => {
    await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "human",
      lastUsedAt: new Date(NOW.getTime() - 40 * DAY_MS).toISOString(),
      name: "warming-up",
    });
    const liveDir = join(
      configDir,
      "orgs",
      ORG_ID,
      "profiles",
      profileId,
      "skills",
      "warming-up"
    );

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.stale).toBe(1);
    expect(result.archived).toBe(0);
    expect(await pathExists(liveDir)).toBe(true);
  });

  test("does not archive a never-matched skill younger than 30 days", async () => {
    await addAssignedSkill({
      createdAt: new Date(NOW.getTime() - 10 * DAY_MS).toISOString(),
      createdBy: "agent",
      name: "brand-new",
    });

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.skippedTooNew).toBe(1);
    expect(result.archived).toBe(0);
  });

  test("archives a never-matched skill older than 90 days", async () => {
    const skillId = await addAssignedSkill({
      createdAt: new Date(NOW.getTime() - 100 * DAY_MS).toISOString(),
      createdBy: "human",
      name: "forgotten",
    });

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.archived).toBe(1);
    expect(await db.listSkillsForProfile(profileId)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: skillId })])
    );
  });

  test("skips bundled skills even when unused for 200 days", async () => {
    const skillId = await addAssignedSkill({
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "bundled",
      lastUsedAt: new Date(NOW.getTime() - 200 * DAY_MS).toISOString(),
      name: "manage-skills",
    });

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.skippedBundled).toBeGreaterThan(0);
    expect(result.archived).toBe(0);
    expect(await db.listSkillsForProfile(profileId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: skillId })])
    );
  });

  test("skips archive when the profile has an enabled automation", async () => {
    const skillId = await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "human",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "cron-playbook",
    });
    await db.upsertAutomation({
      createdAt: NOW.toISOString(),
      definition: {
        prompt: "run",
        steps: [],
        trigger: { type: "manual" },
        version: 1,
      },
      enabled: true,
      id: "auto_1",
      name: "Nightly",
      orgId: ORG_ID,
      profileId,
      updatedAt: NOW.toISOString(),
      version: 1,
    });

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.stale).toBe(1);
    expect(result.skippedAutomation).toBe(1);
    expect(result.archived).toBe(0);
    expect(await db.listSkillsForProfile(profileId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: skillId })])
    );
  });

  test("archives even when skill write approval is on and creates no proposal", async () => {
    await db.upsertOrganization({
      createdAt: NOW.toISOString(),
      id: ORG_ID,
      name: "Curator Org",
      skillsWriteApproval: true,
      slug: "curator-org",
      updatedAt: NOW.toISOString(),
    });
    await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "agent",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "gated-playbook",
    });

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.archived).toBe(1);
    expect(await db.listSkillProposals(ORG_ID)).toHaveLength(0);
  });

  test("dry-run reports a would-archive skill without moving it", async () => {
    await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "agent",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "preview-me",
    });
    const liveDir = join(
      configDir,
      "orgs",
      ORG_ID,
      "profiles",
      profileId,
      "skills",
      "preview-me"
    );

    const result = await curator.run(ORG_ID, {
      dryRun: true,
      now: NOW,
      trigger: "manual",
    });

    expect(result.dryRun).toBe(true);
    expect(result.stale).toBe(1);
    expect(result.archived).toBe(0);
    expect(await pathExists(liveDir)).toBe(true);
  });

  test("restores the directory when unassign fails after rename", async () => {
    await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "agent",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "rollback-me",
    });
    const liveDir = join(
      configDir,
      "orgs",
      ORG_ID,
      "profiles",
      profileId,
      "skills",
      "rollback-me"
    );
    skillsService.unassignArchivedProfileSkill = async () => {
      throw new Error("db down");
    };

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.archived).toBe(0);
    expect(result.skippedError).toBe(1);
    expect(result.restoreMisses).toEqual([]);
    expect(await pathExists(liveDir)).toBe(true);
  });

  test("records skill id and archived path when restore after unassign failure also fails", async () => {
    const skillId = await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "agent",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "stuck-playbook",
    });
    const liveDir = join(
      configDir,
      "orgs",
      ORG_ID,
      "profiles",
      profileId,
      "skills",
      "stuck-playbook"
    );
    const archivedSkillMd = join(
      configDir,
      "orgs",
      ORG_ID,
      "profiles",
      profileId,
      "skills",
      SKILL_ARCHIVE_DIR_NAME,
      "stuck-playbook",
      "SKILL.md"
    );
    skillsService.unassignArchivedProfileSkill = async () => {
      await mkdir(liveDir, { recursive: true });
      await writeFile(join(liveDir, "SKILL.md"), "collision\n");
      throw new Error("db down");
    };

    const result = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });

    expect(result.archived).toBe(0);
    expect(result.skippedError).toBe(1);
    expect(result.restoreMisses).toHaveLength(1);
    expect(result.restoreMisses[0]?.skillId).toBe(skillId);
    expect(result.restoreMisses[0]?.archivedDirectory).toContain(
      `${SKILL_ARCHIVE_DIR_NAME}/stuck-playbook`
    );
    expect(await pathExists(archivedSkillMd)).toBe(true);

    const logDir = getOrgCuratorLogDir(ORG_ID);
    const runJson = JSON.parse(
      await readFile(join(logDir, "run.json"), "utf8")
    );
    expect(runJson.restoreMisses[0].skillId).toBe(skillId);
    const report = await readFile(join(logDir, "REPORT.md"), "utf8");
    expect(report).toContain(skillId);
    expect(report).toContain("stuck-playbook");
  });

  test("overlapping runs for the same org do not double-archive", async () => {
    await addAssignedSkill({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "agent",
      lastUsedAt: new Date(NOW.getTime() - 95 * DAY_MS).toISOString(),
      name: "once-only",
    });
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = 0;
    const original =
      skillsService.unassignArchivedProfileSkill.bind(skillsService);
    skillsService.unassignArchivedProfileSkill = async (...args) => {
      entered += 1;
      await hold;
      return original(...args);
    };

    const first = curator.run(ORG_ID, { now: NOW, trigger: "manual" });
    await bunWaitFor(() => entered === 1);
    const second = await curator.run(ORG_ID, { now: NOW, trigger: "manual" });
    release();
    const firstResult = await first;

    expect(second.status).toBe("in_flight");
    expect(second.archived).toBe(0);
    expect(firstResult.archived).toBe(1);
    expect(entered).toBe(1);
  });
});

async function bunWaitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for curator lock");
    }
    await Bun.sleep(5);
  }
}
