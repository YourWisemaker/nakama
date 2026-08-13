import { describe, expect, test } from "bun:test";
import { createInMemoryDatabaseAdapter } from "@nakama/db";
import type { ProfileService } from "../services/profile-service";
import { SuperBotSessionState } from "../services/super-bot-session-state";
import { bashTool } from "./bash";
import { createGenerateImageTool } from "./generate-image-tool";
import { createSkillManageTools } from "./skill-manage-tool";
import { createSuperBotTools } from "./super-bot-tools";

describe("mutating server tools stay sequential", () => {
  test("bash, generate_image, skill_manage, and create_profile are not parallelSafe", () => {
    expect(bashTool.parallelSafe).not.toBe(true);

    const generateImage = createGenerateImageTool({
      db: createInMemoryDatabaseAdapter(),
      ensureSettingsLoaded: async () => undefined,
      getUserConfig: () => null,
    });
    expect(generateImage.parallelSafe).not.toBe(true);

    const skillManage = createSkillManageTools({
      skillsService: {} as never,
    }).find((tool) => tool.name === "skill_manage");
    expect(skillManage?.parallelSafe).not.toBe(true);

    const superBot = createSuperBotTools(
      {} as ProfileService,
      new SuperBotSessionState()
    );
    for (const name of [
      "create_profile",
      "create_tool",
      "assign_tool_to_profile",
    ]) {
      expect(
        superBot.find((tool) => tool.name === name)?.parallelSafe
      ).not.toBe(true);
    }
  });
});
