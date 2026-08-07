import { afterEach, describe, expect, test } from "bun:test";
import { GENERATE_IMAGE_TOOL_ID } from "@nakama/core/tools/protected";
import {
  createInMemoryDatabaseAdapter,
  ensureGenerateImageToolDefinition,
  removeUnsupportedTools,
  seedDatabase,
  seedOrgSuperBotProfile,
} from "@nakama/db";
import {
  registerGenerateImageTool,
  resolveToolsFromStorage,
} from "../services/tool-resolver";
import {
  GENERATE_IMAGE_TOOL_NAME,
  createGenerateImageTool,
} from "./generate-image-tool";

afterEach(() => {
  registerGenerateImageTool(null);
});

describe("generate_image tool seed and resolver (U3)", () => {
  test("seed creates generate_image tool definition", async () => {
    const db = createInMemoryDatabaseAdapter();

    await ensureGenerateImageToolDefinition(db);

    const tool = await db.getTool(GENERATE_IMAGE_TOOL_ID);
    expect(tool).not.toBeNull();
    expect(tool?.name).toBe(GENERATE_IMAGE_TOOL_NAME);
    expect(tool?.handlerType).toBe("generate_image");
  });

  test("unsupported-handler cleanup retains generate_image after seed", async () => {
    const db = createInMemoryDatabaseAdapter();

    await ensureGenerateImageToolDefinition(db);
    await removeUnsupportedTools(db);

    expect(await db.getTool(GENERATE_IMAGE_TOOL_ID)).not.toBeNull();
  });

  test("seedDatabase includes generate_image and Super Bot is not auto-assigned", async () => {
    const db = createInMemoryDatabaseAdapter();
    await db.upsertOrganization({
      id: "org_a",
      name: "Org A",
      slug: "org-a",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await seedDatabase(db);
    const superBot = await seedOrgSuperBotProfile(db, "org_a");

    expect(await db.getTool(GENERATE_IMAGE_TOOL_ID)).not.toBeNull();

    const assignedIds = (await db.listToolsForProfile(superBot.id)).map((tool) => tool.id);
    expect(assignedIds).not.toContain(GENERATE_IMAGE_TOOL_ID);
  });

  test("resolver returns runnable generate_image for assigned profile", async () => {
    const db = createInMemoryDatabaseAdapter();
    const now = new Date().toISOString();

    registerGenerateImageTool(
      createGenerateImageTool({
        db,
        getUserConfig: () => null,
        ensureSettingsLoaded: async () => {},
      }),
    );

    await ensureGenerateImageToolDefinition(db);
    await db.upsertProfile({
      id: "profile_assigned",
      name: "Assigned",
      systemPrompt: "",
      model: null,
      isSuper: false,
      orgId: "org_a",
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.assignToolToProfile("profile_assigned", GENERATE_IMAGE_TOOL_ID);

    const assigned = await resolveToolsFromStorage(
      await db.listToolsForProfile("profile_assigned"),
      db,
    );
    const tool = assigned.find((entry) => entry.name === GENERATE_IMAGE_TOOL_NAME);

    expect(tool).toBeDefined();
    expect(tool?.parallelSafe).toBe(false);
    expect(typeof tool?.run).toBe("function");
    expect(tool?.parameters?.required).toEqual(["prompt"]);
    expect(tool?.parameters?.properties).not.toHaveProperty("model");
  });

  test("unassigned profile session does not expose generate_image", async () => {
    const db = createInMemoryDatabaseAdapter();
    const now = new Date().toISOString();

    registerGenerateImageTool(
      createGenerateImageTool({
        db,
        getUserConfig: () => null,
        ensureSettingsLoaded: async () => {},
      }),
    );

    await ensureGenerateImageToolDefinition(db);
    await db.upsertProfile({
      id: "profile_unassigned",
      name: "Unassigned",
      systemPrompt: "",
      model: null,
      isSuper: false,
      orgId: "org_a",
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    const tools = await resolveToolsFromStorage(
      await db.listToolsForProfile("profile_unassigned"),
      db,
    );

    expect(tools.map((tool) => tool.name)).not.toContain(GENERATE_IMAGE_TOOL_NAME);
  });

  test("assigned profile tool list includes generate_image once", async () => {
    const db = createInMemoryDatabaseAdapter();
    const now = new Date().toISOString();

    await ensureGenerateImageToolDefinition(db);
    await ensureGenerateImageToolDefinition(db);
    await db.upsertProfile({
      id: "profile_once",
      name: "Once",
      systemPrompt: "",
      model: null,
      isSuper: false,
      orgId: "org_a",
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.assignToolToProfile("profile_once", GENERATE_IMAGE_TOOL_ID);
    await db.assignToolToProfile("profile_once", GENERATE_IMAGE_TOOL_ID);

    const tools = await db.listToolsForProfile("profile_once");
    const matches = tools.filter((tool) => tool.id === GENERATE_IMAGE_TOOL_ID);

    expect(matches).toHaveLength(1);
  });
});
