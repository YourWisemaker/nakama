import { BUNDLED_SKILL_NAMES } from "./bundled-names";
import { isGlobalSkillSourcePath } from "./dedupe";

/** Skip skills patched within this window (null lastPatchedAt = eligible). */
export const SKILL_CONSOLIDATE_RECENT_PATCH_MS = 14 * 24 * 60 * 60 * 1000;

export const SKILL_CONSOLIDATE_MAX_CLUSTERS_PER_RUN = 3;
export const SKILL_CONSOLIDATE_MAX_SOLOS_PER_RUN = 3;
/** Minimum Jaccard overlap on name+description tokens to form a cluster. */
export const SKILL_CONSOLIDATE_MIN_OVERLAP = 0.45;
/** Description+body length above which a non-clustered agent skill is a solo deslopify candidate. */
export const SKILL_CONSOLIDATE_VERBOSE_CHAR_THRESHOLD = 2500;

const bundledSkillNames = new Set<string>(BUNDLED_SKILL_NAMES);

export type SkillConsolidateSkipReason =
  | "not_agent"
  | "bundled"
  | "global"
  | "recent_patch"
  | "pending_proposal"
  | "automation_profile"
  | "budget_exhausted";

export interface ConsolidateSkillInput {
  /** Optional SKILL.md body length for solo verbosity; omit when unknown. */
  bodyCharCount?: number;
  createdBy: string;
  description: string;
  name: string;
  sourcePath: string;
}

export interface ConsolidateUsageInput {
  lastPatchedAt?: string | null;
  lastUsedAt?: string | null;
  useCount?: number;
}

export interface ConsolidateCandidateSkill {
  skill: ConsolidateSkillInput;
  usage: ConsolidateUsageInput | null;
}

export interface ConsolidateCluster {
  losers: ConsolidateCandidateSkill[];
  winner: ConsolidateCandidateSkill;
}

export interface ConsolidateSkippedSkill {
  reason: SkillConsolidateSkipReason;
  skill: ConsolidateSkillInput;
}

export interface ConsolidatePlan {
  clusters: ConsolidateCluster[];
  skipped: ConsolidateSkippedSkill[];
  solos: ConsolidateCandidateSkill[];
}

export interface BuildConsolidatePlanInput {
  /** When true, every skill is skipped as automation_profile. */
  hasEnabledAutomation?: boolean;
  now?: Date;
  pendingSkillNames?: ReadonlySet<string>;
  skills: ConsolidateCandidateSkill[];
}

function toTimestamp(value: string): number | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
  return new Set(tokens);
}

export function skillTokenSet(skill: ConsolidateSkillInput): Set<string> {
  return tokenize(`${skill.name} ${skill.description}`);
}

export function jaccardOverlap(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isExemptFromConsolidate(skill: ConsolidateSkillInput): boolean {
  if (skill.createdBy === "bundled") {
    return true;
  }
  if (bundledSkillNames.has(skill.name)) {
    return true;
  }
  return isGlobalSkillSourcePath(skill.sourcePath);
}

export function classifyConsolidateEligibility(input: {
  hasEnabledAutomation?: boolean;
  now?: Date;
  pendingSkillNames?: ReadonlySet<string>;
  skill: ConsolidateSkillInput;
  usage: ConsolidateUsageInput | null;
}): SkillConsolidateSkipReason | null {
  if (input.hasEnabledAutomation) {
    return "automation_profile";
  }
  if (input.skill.createdBy !== "agent") {
    return "not_agent";
  }
  if (isExemptFromConsolidate(input.skill)) {
    return bundledSkillNames.has(input.skill.name) ||
      input.skill.createdBy === "bundled"
      ? "bundled"
      : "global";
  }
  if (input.pendingSkillNames?.has(input.skill.name)) {
    return "pending_proposal";
  }
  const patchedAt = input.usage?.lastPatchedAt;
  if (patchedAt) {
    const patchedMs = toTimestamp(patchedAt);
    if (patchedMs != null) {
      const now = input.now?.getTime() ?? Date.now();
      if (now - patchedMs < SKILL_CONSOLIDATE_RECENT_PATCH_MS) {
        return "recent_patch";
      }
    }
  }
  return null;
}

function rankScore(candidate: ConsolidateCandidateSkill): number {
  const useCount = candidate.usage?.useCount ?? 0;
  const lastUsed = candidate.usage?.lastUsedAt
    ? (toTimestamp(candidate.usage.lastUsedAt) ?? 0)
    : 0;
  return useCount * 1_000_000_000_000 + lastUsed;
}

function compareCandidates(
  left: ConsolidateCandidateSkill,
  right: ConsolidateCandidateSkill
): number {
  const scoreDiff = rankScore(right) - rankScore(left);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  return left.skill.name.localeCompare(right.skill.name);
}

function contentLength(candidate: ConsolidateCandidateSkill): number {
  const body = candidate.skill.bodyCharCount ?? 0;
  return candidate.skill.description.length + body;
}

/**
 * Pure planning helper: filter eligible agent skills, form overlapping clusters,
 * and list solo deslopify candidates under per-run budget caps.
 */
export function buildConsolidatePlan(
  input: BuildConsolidatePlanInput
): ConsolidatePlan {
  const skipped: ConsolidateSkippedSkill[] = [];
  const eligible: ConsolidateCandidateSkill[] = [];

  for (const candidate of input.skills) {
    const reason = classifyConsolidateEligibility({
      hasEnabledAutomation: input.hasEnabledAutomation,
      now: input.now,
      pendingSkillNames: input.pendingSkillNames,
      skill: candidate.skill,
      usage: candidate.usage,
    });
    if (reason) {
      skipped.push({ reason, skill: candidate.skill });
      continue;
    }
    eligible.push(candidate);
  }

  const tokenByName = new Map<string, Set<string>>();
  for (const candidate of eligible) {
    tokenByName.set(candidate.skill.name, skillTokenSet(candidate.skill));
  }

  const assigned = new Set<string>();
  const clusters: ConsolidateCluster[] = [];

  const sorted = [...eligible].sort(compareCandidates);

  for (const seed of sorted) {
    if (assigned.has(seed.skill.name)) {
      continue;
    }
    if (clusters.length >= SKILL_CONSOLIDATE_MAX_CLUSTERS_PER_RUN) {
      break;
    }

    const seedTokens = tokenByName.get(seed.skill.name);
    if (!seedTokens) {
      continue;
    }

    const members: ConsolidateCandidateSkill[] = [seed];
    for (const other of sorted) {
      if (other.skill.name === seed.skill.name) {
        continue;
      }
      if (assigned.has(other.skill.name)) {
        continue;
      }
      const otherTokens = tokenByName.get(other.skill.name);
      if (!otherTokens) {
        continue;
      }
      if (
        jaccardOverlap(seedTokens, otherTokens) >= SKILL_CONSOLIDATE_MIN_OVERLAP
      ) {
        members.push(other);
      }
    }

    if (members.length < 2) {
      continue;
    }

    members.sort(compareCandidates);
    const winner = members[0];
    if (!winner) {
      continue;
    }
    const losers = members.slice(1);
    for (const member of members) {
      assigned.add(member.skill.name);
    }
    clusters.push({ losers, winner });
  }

  const remaining = sorted.filter(
    (candidate) => !assigned.has(candidate.skill.name)
  );

  const solos: ConsolidateCandidateSkill[] = [];
  for (const candidate of remaining) {
    if (contentLength(candidate) < SKILL_CONSOLIDATE_VERBOSE_CHAR_THRESHOLD) {
      continue;
    }
    if (solos.length >= SKILL_CONSOLIDATE_MAX_SOLOS_PER_RUN) {
      skipped.push({
        reason: "budget_exhausted",
        skill: candidate.skill,
      });
      continue;
    }
    solos.push(candidate);
    assigned.add(candidate.skill.name);
  }

  return { clusters, skipped, solos };
}
