import { describe, expect, test } from "bun:test";
import {
  resolveCuratorScheduleAction,
  SKILL_CURATOR_INTERVAL_MS,
} from "./curator-schedule";

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("resolveCuratorScheduleAction", () => {
  test("skips disabled orgs", () => {
    expect(
      resolveCuratorScheduleAction({
        enabled: false,
        lastRunAt: null,
        now: NOW,
      })
    ).toBe("skip");
  });

  test("seeds when enabled and last run is missing", () => {
    expect(
      resolveCuratorScheduleAction({
        enabled: true,
        lastRunAt: null,
        now: NOW,
      })
    ).toBe("seed");
  });

  test("runs a live schedule when the last run is at least 7 days old", () => {
    expect(
      resolveCuratorScheduleAction({
        enabled: true,
        lastRunAt: new Date(
          NOW.getTime() - SKILL_CURATOR_INTERVAL_MS
        ).toISOString(),
        now: NOW,
      })
    ).toBe("schedule");
  });

  test("skips when the last run is newer than 7 days", () => {
    expect(
      resolveCuratorScheduleAction({
        enabled: true,
        lastRunAt: new Date(
          NOW.getTime() - SKILL_CURATOR_INTERVAL_MS + 1
        ).toISOString(),
        now: NOW,
      })
    ).toBe("skip");
  });
});
