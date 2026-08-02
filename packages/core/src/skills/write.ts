import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../fs";
import { getUserConfigDir } from "../user-config";
import { BUNDLED_SKILL_NAMES } from "./bundled-names";
import { isGlobalSkillSourcePath } from "./dedupe";
import { parseSkillMarkdown } from "./parse";
import {
  getGlobalSkillsDir,
  getProfileSkillsDir,
  SKILL_FILE_NAME,
  SKILL_TOOL_FILES,
} from "./paths";

const bundledSkillNames = new Set<string>(BUNDLED_SKILL_NAMES);
const SKILL_NAME_PATTERN = /^[a-z0-9-]{1,64}$/;

export interface CreateSkillFileOptions {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
  orgId?: string;
  profileId?: string;
}

export function composeSkillMarkdown(options: {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
}): string {
  const lines = [
    "---",
    `name: ${options.name}`,
    `description: ${options.description}`,
  ];

  if (options.disableModelInvocation) {
    lines.push("disable-model-invocation: true");
  }

  lines.push("---", "", options.body?.trim() ?? "");

  return `${lines.join("\n").trimEnd()}\n`;
}

export function assertValidSkillName(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (!SKILL_NAME_PATTERN.test(normalized)) {
    throw new Error(
      "Skill name must be lowercase letters, numbers, or hyphens (max 64 chars).",
    );
  }

  return normalized;
}

export function assertNotBundledSkillName(name: string): void {
  if (bundledSkillNames.has(name)) {
    throw new Error(`Bundled system skill "${name}" cannot be modified by agents.`);
  }
}

export function resolveProfileSkillDirectory(
  orgId: string,
  profileId: string,
  name: string,
): string {
  const skillName = assertValidSkillName(name);
  assertNotBundledSkillName(skillName);

  const skillsRoot = path.resolve(getProfileSkillsDir(orgId, profileId));
  const directory = path.resolve(path.join(skillsRoot, skillName));

  if (directory !== skillsRoot && !directory.startsWith(`${skillsRoot}${path.sep}`)) {
    throw new Error("Skill directory escapes the profile skills path.");
  }

  return directory;
}

export function assertPathWithinProfileSkillsDir(
  orgId: string,
  profileId: string,
  targetPath: string,
): string {
  const skillsRoot = path.resolve(getProfileSkillsDir(orgId, profileId));
  const resolved = path.resolve(targetPath);

  if (resolved !== skillsRoot && !resolved.startsWith(`${skillsRoot}${path.sep}`)) {
    throw new Error("Path is outside the profile skills directory.");
  }

  if (isGlobalSkillSourcePath(resolved)) {
    throw new Error("Global skills cannot be modified by agents.");
  }

  return resolved;
}

export function assertSupportingFileAllowed(filePath: string): void {
  const base = path.basename(filePath);

  if (base === SKILL_FILE_NAME) {
    throw new Error(
      `Use patch/edit for ${SKILL_FILE_NAME}; write_file/remove_file are for supporting files only.`,
    );
  }

  if ((SKILL_TOOL_FILES as readonly string[]).includes(base)) {
    throw new Error(
      `Skill-local tools (${SKILL_TOOL_FILES.join(", ")}) cannot be written by agents in Phase 1.`,
    );
  }
}

export async function createSkillFile(options: CreateSkillFileOptions): Promise<string> {
  const name = options.name.trim().toLowerCase();
  const description = options.description.trim();
  const skillsRoot =
    options.orgId && options.profileId
      ? getProfileSkillsDir(options.orgId, options.profileId)
      : getGlobalSkillsDir();
  const directory = path.join(skillsRoot, name);
  const skillFilePath = path.join(directory, SKILL_FILE_NAME);

  if (await pathExists(skillFilePath)) {
    throw new Error(`Skill "${name}" already exists.`);
  }

  const content = composeSkillMarkdown({
    name,
    description,
    body: options.body,
    disableModelInvocation: options.disableModelInvocation,
  });

  parseSkillMarkdown(content, skillFilePath);

  await mkdir(directory, { recursive: true });
  await writeFile(skillFilePath, content, "utf8");

  return directory;
}

export async function writeRawProfileSkillMarkdown(options: {
  orgId: string;
  profileId: string;
  content: string;
  allowExisting?: boolean;
}): Promise<{
  directory: string;
  name: string;
  description: string;
  created: boolean;
}> {
  const skillFileProbe = path.join(
    getProfileSkillsDir(options.orgId, options.profileId),
    "_probe",
    SKILL_FILE_NAME,
  );
  const parsed = parseSkillMarkdown(options.content, skillFileProbe);
  const name = assertValidSkillName(parsed.frontmatter.name);
  assertNotBundledSkillName(name);

  if (name !== parsed.frontmatter.name) {
    throw new Error("Skill frontmatter name must be lowercase kebab-case.");
  }

  const directory = resolveProfileSkillDirectory(options.orgId, options.profileId, name);
  const skillFilePath = path.join(directory, SKILL_FILE_NAME);
  const exists = await pathExists(skillFilePath);

  if (exists && !options.allowExisting) {
    throw new Error(`Skill "${name}" already exists.`);
  }

  parseSkillMarkdown(options.content, skillFilePath);

  const nextContent = options.content.endsWith("\n")
    ? options.content
    : `${options.content}\n`;

  if (!exists) {
    await mkdir(directory, { recursive: true });
    await writeFile(skillFilePath, nextContent, "utf8");
    return {
      directory,
      name,
      description: parsed.frontmatter.description,
      created: true,
    };
  }

  const existing = await readFile(skillFilePath, "utf8");
  parseSkillMarkdown(existing, skillFilePath);

  if (existing !== nextContent) {
    await writeFile(skillFilePath, nextContent, "utf8");
  }

  const finalParsed = parseSkillMarkdown(nextContent, skillFilePath);
  return {
    directory,
    name: finalParsed.frontmatter.name,
    description: finalParsed.frontmatter.description,
    created: false,
  };
}

export async function patchSkillFile(options: {
  orgId: string;
  profileId: string;
  name: string;
  oldString: string;
  newString: string;
}): Promise<{
  directory: string;
  name: string;
  description: string;
}> {
  if (!options.oldString) {
    throw new Error("old_string is required for patch.");
  }

  const directory = resolveProfileSkillDirectory(
    options.orgId,
    options.profileId,
    options.name,
  );
  const skillFilePath = path.join(directory, SKILL_FILE_NAME);

  if (!(await pathExists(skillFilePath))) {
    throw new Error(`Skill "${options.name}" not found.`);
  }

  assertPathWithinProfileSkillsDir(options.orgId, options.profileId, skillFilePath);

  const existing = await readFile(skillFilePath, "utf8");
  const occurrences = existing.split(options.oldString).length - 1;

  if (occurrences === 0) {
    throw new Error("old_string not found in SKILL.md.");
  }

  if (occurrences > 1) {
    throw new Error("old_string matched multiple times in SKILL.md; make the match unique.");
  }

  const next = existing.replace(options.oldString, options.newString);
  const parsed = parseSkillMarkdown(next, skillFilePath);
  const expectedName = assertValidSkillName(options.name);

  if (parsed.frontmatter.name !== expectedName) {
    throw new Error("patch cannot rename a skill via frontmatter; create a new skill instead.");
  }

  assertNotBundledSkillName(parsed.frontmatter.name);
  await writeFile(skillFilePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");

  return {
    directory,
    name: parsed.frontmatter.name,
    description: parsed.frontmatter.description,
  };
}

function isManagedSkillDirectory(directory: string): boolean {
  const configDir = path.resolve(getUserConfigDir());
  const resolved = path.resolve(directory);

  if (!resolved.startsWith(`${configDir}${path.sep}`)) {
    return false;
  }

  const relative = path.relative(configDir, resolved);
  const parts = relative.split(path.sep);

  if (parts[0] === "agent" && parts[1] === "skills" && parts.length >= 3) {
    return true;
  }

  return parts[0] === "orgs" && parts[2] === "profiles" && parts[4] === "skills" && parts.length >= 6;
}

export async function deleteSkillDirectory(directory: string): Promise<void> {
  if (!isManagedSkillDirectory(directory)) {
    throw new Error("Skill directory is outside the allowed skills path.");
  }

  await rm(directory, { recursive: true, force: true });
}
