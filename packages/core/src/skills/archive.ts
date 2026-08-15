import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../fs";
import {
  getProfileSkillsArchiveDir,
  getProfileSkillsDir,
  SKILL_ARCHIVE_DIR_NAME,
} from "./paths";
import {
  assertNotBundledSkillName,
  assertValidSkillName,
  isPathWithinProfileSkillsDir,
  resolveProfileSkillDirectory,
} from "./write";

export const SKILL_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
export const SKILL_ARCHIVE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

export type SkillFreshness = "active" | "stale" | "archive_due";

function toTimestamp(value: string | Date): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error("Invalid skill freshness timestamp.");
  }
  return time;
}

export function classifySkillFreshness(input: {
  createdAt: string | Date;
  lastUsedAt?: string | Date | null;
  now?: Date;
}): SkillFreshness {
  const now = input.now?.getTime() ?? Date.now();
  const clock = input.lastUsedAt
    ? toTimestamp(input.lastUsedAt)
    : toTimestamp(input.createdAt);
  const unusedForMs = now - clock;

  if (unusedForMs >= SKILL_ARCHIVE_AFTER_MS) {
    return "archive_due";
  }

  if (unusedForMs >= SKILL_STALE_AFTER_MS) {
    return "stale";
  }

  return "active";
}

function isUnderArchiveDir(
  orgId: string,
  profileId: string,
  targetPath: string
): boolean {
  const archiveRoot = path.resolve(
    getProfileSkillsArchiveDir(orgId, profileId)
  );
  const resolved = path.resolve(targetPath);
  return (
    resolved === archiveRoot || resolved.startsWith(`${archiveRoot}${path.sep}`)
  );
}

export async function archiveSkillDirectory(options: {
  orgId: string;
  profileId: string;
  skillName: string;
  now?: Date;
}): Promise<{ archivedDirectory: string; skillName: string }> {
  const skillName = assertValidSkillName(options.skillName);
  assertNotBundledSkillName(skillName);

  const liveDirectory = resolveProfileSkillDirectory(
    options.orgId,
    options.profileId,
    skillName
  );

  if (isUnderArchiveDir(options.orgId, options.profileId, liveDirectory)) {
    throw new Error("Skill is already archived.");
  }

  if (
    !isPathWithinProfileSkillsDir(
      options.orgId,
      options.profileId,
      liveDirectory
    )
  ) {
    throw new Error("Path is outside the profile skills directory.");
  }

  if (!(await pathExists(liveDirectory))) {
    throw new Error(`Skill "${skillName}" not found.`);
  }

  const archiveRoot = getProfileSkillsArchiveDir(
    options.orgId,
    options.profileId
  );
  await mkdir(archiveRoot, { recursive: true });

  let archivedDirectory = path.join(archiveRoot, skillName);
  if (await pathExists(archivedDirectory)) {
    const stamp = (options.now ?? new Date()).getTime();
    archivedDirectory = path.join(archiveRoot, `${skillName}-${stamp}`);
  }

  if (
    !isPathWithinProfileSkillsDir(
      options.orgId,
      options.profileId,
      archivedDirectory
    )
  ) {
    throw new Error("Archive path is outside the profile skills directory.");
  }

  if (
    !archivedDirectory.includes(
      `${path.sep}${SKILL_ARCHIVE_DIR_NAME}${path.sep}`
    )
  ) {
    throw new Error("Archive path must stay under skills/.archive.");
  }

  await rename(liveDirectory, archivedDirectory);

  return { archivedDirectory, skillName };
}

export async function restoreArchivedSkillDirectory(options: {
  orgId: string;
  profileId: string;
  skillName: string;
  archivedDirectory: string;
}): Promise<{ directory: string }> {
  const skillName = assertValidSkillName(options.skillName);
  assertNotBundledSkillName(skillName);

  if (
    !isPathWithinProfileSkillsDir(
      options.orgId,
      options.profileId,
      options.archivedDirectory
    )
  ) {
    throw new Error("Path is outside the profile skills directory.");
  }

  if (
    !isUnderArchiveDir(
      options.orgId,
      options.profileId,
      options.archivedDirectory
    )
  ) {
    throw new Error("Restore path must be under skills/.archive.");
  }

  const liveDirectory = path.join(
    getProfileSkillsDir(options.orgId, options.profileId),
    skillName
  );

  if (await pathExists(liveDirectory)) {
    throw new Error(`Skill "${skillName}" already exists in the live catalog.`);
  }

  await rename(options.archivedDirectory, liveDirectory);
  return { directory: liveDirectory };
}
