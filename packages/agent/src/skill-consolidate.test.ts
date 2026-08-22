import { describe, expect, test } from "bun:test";
import { buildSkillConsolidatePrompt } from "./skill-consolidate";

describe("buildSkillConsolidatePrompt", () => {
  test("includes winner and losers for merge mode", () => {
    const prompt = buildSkillConsolidatePrompt({
      losers: [
        {
          body: "Loser body",
          description: "Loser desc",
          name: "deploy-assistant",
        },
      ],
      mode: "merge",
      winner: {
        body: "Winner body",
        description: "Winner desc",
        name: "deploy-helper",
      },
    });
    expect(prompt).toContain("deploy-helper");
    expect(prompt).toContain("deploy-assistant");
    expect(prompt).toContain("Winner body");
    expect(prompt).toContain("Loser body");
  });
});
