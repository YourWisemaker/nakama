import { describe, expect, test } from "bun:test";
import { SKILL_CURATOR_INTERVAL_MS } from "@nakama/core";
import { tickSkillCurator } from "./curator-tick";

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("tickSkillCurator", () => {
  test("seeds enabled orgs with no last run and skips disabled orgs", async () => {
    const runs: Array<{ orgId: string; trigger: string }> = [];
    const result = await tickSkillCurator(
      {
        listSkillCuratorOrgs: async () => ({
          orgs: [
            {
              id: "org_enabled",
              skillsCuratorEnabled: true,
              skillsCuratorLastRunAt: null,
            },
          ],
        }),
        runSkillCuratorInternal: async (orgId, request) => {
          runs.push({ orgId, trigger: request.trigger });
          return {
            result: {
              archived: 0,
              dryRun: true,
              finishedAt: NOW.toISOString(),
              orgId,
              restoreMisses: [],
              scanned: 0,
              skippedAutomation: 0,
              skippedBundled: 0,
              skippedError: 0,
              skippedTooNew: 0,
              stale: 0,
              startedAt: NOW.toISOString(),
              status: "completed",
              trigger: request.trigger,
            },
          };
        },
      },
      NOW
    );

    expect(result).toEqual({ ran: 1, skipped: 0 });
    expect(runs).toEqual([{ orgId: "org_enabled", trigger: "seed" }]);
  });

  test("runs a live schedule when last run is at least 7 days old", async () => {
    const runs: string[] = [];
    await tickSkillCurator(
      {
        listSkillCuratorOrgs: async () => ({
          orgs: [
            {
              id: "org_due",
              skillsCuratorEnabled: true,
              skillsCuratorLastRunAt: new Date(
                NOW.getTime() - SKILL_CURATOR_INTERVAL_MS
              ).toISOString(),
            },
          ],
        }),
        runSkillCuratorInternal: async (orgId, request) => {
          runs.push(request.trigger);
          return {
            result: {
              archived: 0,
              dryRun: false,
              finishedAt: NOW.toISOString(),
              orgId,
              restoreMisses: [],
              scanned: 0,
              skippedAutomation: 0,
              skippedBundled: 0,
              skippedError: 0,
              skippedTooNew: 0,
              stale: 0,
              startedAt: NOW.toISOString(),
              status: "completed",
              trigger: request.trigger,
            },
          };
        },
      },
      NOW
    );

    expect(runs).toEqual(["schedule"]);
  });

  test("does not call curator when no enabled orgs are returned", async () => {
    let called = false;
    const result = await tickSkillCurator(
      {
        listSkillCuratorOrgs: async () => ({ orgs: [] }),
        runSkillCuratorInternal: async () => {
          called = true;
          throw new Error("should not run");
        },
      },
      NOW
    );

    expect(called).toBe(false);
    expect(result).toEqual({ ran: 0, skipped: 0 });
  });
});
