import type { NakamaClient } from "@nakama/client";
import { resolveCuratorScheduleAction } from "@nakama/core";

export async function tickSkillCurator(
  client: Pick<
    NakamaClient,
    "listSkillCuratorOrgs" | "runSkillCuratorInternal"
  >,
  now = new Date()
): Promise<{ ran: number; skipped: number }> {
  const { orgs } = await client.listSkillCuratorOrgs();
  let ran = 0;
  let skipped = 0;

  for (const org of orgs) {
    const action = resolveCuratorScheduleAction({
      enabled: org.skillsCuratorEnabled,
      lastRunAt: org.skillsCuratorLastRunAt,
      now,
    });

    if (action === "skip") {
      skipped += 1;
      continue;
    }

    await client.runSkillCuratorInternal(org.id, { trigger: action });
    ran += 1;
  }

  return { ran, skipped };
}
