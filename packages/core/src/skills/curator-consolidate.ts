import { resolveProfileOrgBooleanOverride } from "./profile-org-override";

export interface SkillCuratorConsolidateSources {
  orgSkillsCuratorConsolidateEnabled?: boolean | null;
  profileSkillsCuratorConsolidateEnabled?: boolean | null;
}

/** Profile override wins when non-null; otherwise org default (false when unset). */
export function resolveSkillCuratorConsolidateEnabled(
  sources: SkillCuratorConsolidateSources
): boolean {
  return resolveProfileOrgBooleanOverride(
    sources.profileSkillsCuratorConsolidateEnabled,
    sources.orgSkillsCuratorConsolidateEnabled
  );
}
