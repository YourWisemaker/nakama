import { describe, expect, test } from "bun:test";
import { resolveSkillCuratorConsolidateEnabled } from "./curator-consolidate";

describe("resolveSkillCuratorConsolidateEnabled", () => {
  test("defaults to false when org and profile unset", () => {
    expect(resolveSkillCuratorConsolidateEnabled({})).toBe(false);
  });

  test("org true enables consolidate when profile inherits", () => {
    expect(
      resolveSkillCuratorConsolidateEnabled({
        orgSkillsCuratorConsolidateEnabled: true,
        profileSkillsCuratorConsolidateEnabled: null,
      })
    ).toBe(true);
  });

  test("profile false overrides org true", () => {
    expect(
      resolveSkillCuratorConsolidateEnabled({
        orgSkillsCuratorConsolidateEnabled: true,
        profileSkillsCuratorConsolidateEnabled: false,
      })
    ).toBe(false);
  });

  test("profile true forces consolidate on when org false", () => {
    expect(
      resolveSkillCuratorConsolidateEnabled({
        orgSkillsCuratorConsolidateEnabled: false,
        profileSkillsCuratorConsolidateEnabled: true,
      })
    ).toBe(true);
  });
});
