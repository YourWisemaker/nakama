import { join } from "node:path";
import {
  archiveSkillDirectory,
  BUNDLED_SKILL_NAMES,
  classifySkillFreshness,
  getOrgCuratorLogDir,
  isGlobalSkillSourcePath,
  pathExists,
  readTextIfExists,
  restoreArchivedSkillDirectory,
  writePrivateTextFile,
} from "@nakama/core";
import type { DatabaseAdapter, StoredSkillRecord } from "@nakama/db";
import type { SkillsService } from "./skills-service";

const bundledSkillNames = new Set<string>(BUNDLED_SKILL_NAMES);

export type SkillCuratorTrigger = "schedule" | "manual" | "seed";

export interface SkillCuratorRunOptions {
  dryRun?: boolean;
  now?: Date;
  trigger: SkillCuratorTrigger;
}

export interface SkillCuratorRunResult {
  archived: number;
  dryRun: boolean;
  finishedAt: string;
  orgId: string;
  scanned: number;
  skippedAutomation: number;
  skippedBundled: number;
  skippedError: number;
  skippedTooNew: number;
  stale: number;
  startedAt: string;
  status: "completed" | "in_flight";
  trigger: SkillCuratorTrigger;
}

const emptyCounts = {
  archived: 0,
  scanned: 0,
  skippedAutomation: 0,
  skippedBundled: 0,
  skippedError: 0,
  skippedTooNew: 0,
  stale: 0,
};

export class SkillCuratorService {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly db: DatabaseAdapter,
    private readonly skillsService: SkillsService
  ) {}

  async run(
    orgId: string,
    options: SkillCuratorRunOptions
  ): Promise<SkillCuratorRunResult> {
    const startedAt = (options.now ?? new Date()).toISOString();
    const dryRun = options.dryRun === true || options.trigger === "seed";

    if (this.inFlight.has(orgId)) {
      return {
        ...emptyCounts,
        dryRun,
        finishedAt: startedAt,
        orgId,
        startedAt,
        status: "in_flight",
        trigger: options.trigger,
      };
    }

    this.inFlight.add(orgId);

    try {
      const result = await this.runLocked(orgId, {
        ...options,
        dryRun,
        startedAt,
      });
      await this.writeReports(orgId, result);
      return result;
    } finally {
      this.inFlight.delete(orgId);
    }
  }

  async readLatest(orgId: string): Promise<SkillCuratorRunResult | null> {
    const raw = await readTextIfExists(
      join(getOrgCuratorLogDir(orgId), "run.json")
    );
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SkillCuratorRunResult;
    if (parsed.orgId !== orgId) {
      return null;
    }

    return parsed;
  }

  private async runLocked(
    orgId: string,
    options: SkillCuratorRunOptions & { dryRun: boolean; startedAt: string }
  ): Promise<SkillCuratorRunResult> {
    const now = options.now ?? new Date();
    const counts = { ...emptyCounts };
    const profiles = await this.db.listProfilesForOrg(orgId);
    const enabledAutomationProfileIds = new Set(
      (await this.db.listAutomationsForOrg(orgId))
        .filter((automation) => automation.enabled)
        .map((automation) => automation.profileId)
    );

    for (const profile of profiles) {
      const assigned = await this.db.listSkillsForProfile(profile.id);
      const usageBySkillId = new Map(
        (await this.db.listSkillUsageForProfile(profile.id)).map((row) => [
          row.skillId,
          row,
        ])
      );

      for (const skill of assigned) {
        counts.scanned += 1;

        if (isExemptFromCurator(skill)) {
          counts.skippedBundled += 1;
          continue;
        }

        const usage = usageBySkillId.get(skill.id);
        const freshness = classifySkillFreshness({
          createdAt: skill.createdAt,
          lastUsedAt: usage?.lastUsedAt,
          now,
        });

        if (freshness === "active") {
          counts.skippedTooNew += 1;
          continue;
        }

        counts.stale += 1;

        if (freshness !== "archive_due") {
          continue;
        }

        if (enabledAutomationProfileIds.has(profile.id)) {
          counts.skippedAutomation += 1;
          continue;
        }

        if (options.dryRun) {
          continue;
        }

        const archived = await this.archiveAssignedSkill({
          now,
          orgId,
          profileId: profile.id,
          skill,
        });

        if (archived) {
          counts.archived += 1;
        } else {
          counts.skippedError += 1;
        }
      }
    }

    return {
      ...counts,
      dryRun: options.dryRun,
      finishedAt: new Date().toISOString(),
      orgId,
      startedAt: options.startedAt,
      status: "completed",
      trigger: options.trigger,
    };
  }

  private async archiveAssignedSkill(input: {
    orgId: string;
    profileId: string;
    skill: StoredSkillRecord;
    now: Date;
  }): Promise<boolean> {
    let archivedDirectory: string | null = null;

    try {
      const archived = await archiveSkillDirectory({
        now: input.now,
        orgId: input.orgId,
        profileId: input.profileId,
        skillName: input.skill.name,
      });
      archivedDirectory = archived.archivedDirectory;
      await this.skillsService.unassignArchivedProfileSkill(
        input.orgId,
        input.profileId,
        input.skill.id,
        archived.archivedDirectory
      );
      return true;
    } catch {
      if (archivedDirectory && (await pathExists(archivedDirectory))) {
        try {
          await restoreArchivedSkillDirectory({
            archivedDirectory,
            orgId: input.orgId,
            profileId: input.profileId,
            skillName: input.skill.name,
          });
        } catch {
          // Report the original failure; a restore miss is still an error skip.
        }
      }

      return false;
    }
  }

  private async writeReports(
    orgId: string,
    result: SkillCuratorRunResult
  ): Promise<void> {
    const logDir = getOrgCuratorLogDir(orgId);
    await writePrivateTextFile(
      join(logDir, "run.json"),
      `${JSON.stringify(result, null, 2)}\n`
    );
    await writePrivateTextFile(
      join(logDir, "REPORT.md"),
      formatCuratorReport(result)
    );
  }
}

function isExemptFromCurator(skill: StoredSkillRecord): boolean {
  return (
    skill.createdBy === "bundled" ||
    bundledSkillNames.has(skill.name) ||
    isGlobalSkillSourcePath(skill.sourcePath)
  );
}

function formatCuratorReport(result: SkillCuratorRunResult): string {
  return [
    "# Skill curator",
    "",
    `- org: ${result.orgId}`,
    `- trigger: ${result.trigger}`,
    `- dryRun: ${result.dryRun}`,
    `- scanned: ${result.scanned}`,
    `- stale: ${result.stale}`,
    `- archived: ${result.archived}`,
    `- skippedBundled: ${result.skippedBundled}`,
    `- skippedAutomation: ${result.skippedAutomation}`,
    `- skippedTooNew: ${result.skippedTooNew}`,
    `- skippedError: ${result.skippedError}`,
    "",
  ].join("\n");
}
