import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { UserConfig } from "@nakama/core";
import { GENERATE_IMAGE_TOOL_ID } from "@nakama/core/tools/protected";
import {
  createInMemoryDatabaseAdapter,
  ensureGenerateImageToolDefinition,
  removeUnsupportedTools,
  seedDatabase,
  seedOrgSuperBotProfile,
} from "@nakama/db";
import { IMAGE_GENERATION_SELECTION } from "../providers/models";
import { IMAGE_MODEL_REQUIRED_MESSAGE } from "../services/image-generation";
import {
  registerGenerateImageTool,
  resolveToolsFromStorage,
} from "../services/tool-resolver";
import {
  GENERATE_IMAGE_TOOL_NAME,
  createGenerateImageTool,
  runGenerateImageTool,
} from "./generate-image-tool";

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const openaiConfig = (overrides?: Partial<UserConfig>): UserConfig => ({
  defaultProviderId: "p-openai",
  providers: [
    {
      id: "p-openai",
      type: "openai",
      label: "OpenAI",
      apiKey: "test-key",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  ...overrides,
});

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

describe("generate_image tool persistence (U4)", () => {
  const originalConfigDir = process.env.NAKAMA_CONFIG_DIR;
  let tempConfigDir = "";
  let workspaceRoot = "";

  afterEach(async () => {
    if (tempConfigDir) {
      await rm(tempConfigDir, { recursive: true, force: true });
      tempConfigDir = "";
    }
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
      workspaceRoot = "";
    }
    if (originalConfigDir === undefined) {
      delete process.env.NAKAMA_CONFIG_DIR;
    } else {
      process.env.NAKAMA_CONFIG_DIR = originalConfigDir;
    }
  });

  async function setupWorkspace() {
    tempConfigDir = await mkdtemp(path.join(tmpdir(), "nakama-gen-img-cfg-"));
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "nakama-gen-img-ws-"));
    process.env.NAKAMA_CONFIG_DIR = tempConfigDir;
  }

  test("prompt produces PNG path + sidecar + attachmentId", async () => {
    await setupWorkspace();
    const db = createInMemoryDatabaseAdapter();
    const usage: Array<{ model: string; input: number; output: number }> = [];

    const result = await runGenerateImageTool(
      { prompt: "a cat", filename: "cat.png" },
      {
        orgId: "org_1",
        profileId: "profile_1",
        sessionId: "session_1",
        channel: "web",
        workspaceRoot,
      },
      {
        db,
        getUserConfig: () => openaiConfig({ imageModel: IMAGE_GENERATION_SELECTION }),
        ensureSettingsLoaded: async () => {},
        recordUsage: (model, input, output) => {
          usage.push({ model, input, output });
        },
        generateImage: async () => ({
          mediaType: "image/png",
          data: PNG_BYTES,
          model: "gpt-image-2",
          size: "1024x1024",
          usage: { inputTokens: 8, outputTokens: 200 },
        }),
      },
    );

    expect(result).toMatchObject({
      path: "artifacts/cat.png",
      mimeType: "image/png",
      sizeBytes: PNG_BYTES.byteLength,
      model: "gpt-image-2",
    });
    expect("attachmentId" in result && typeof result.attachmentId === "string").toBe(true);
    if (!("attachmentId" in result) || !result.attachmentId) {
      throw new Error("expected attachmentId");
    }

    const absolute = path.join(workspaceRoot, result.path);
    expect(await readFile(absolute)).toEqual(Buffer.from(PNG_BYTES));
    const meta = JSON.parse(await readFile(`${absolute}.nakama-meta.json`, "utf8")) as {
      mimeType: string;
      sizeBytes: number;
      savedAt: string;
    };
    expect(meta.mimeType).toBe("image/png");
    expect(meta.sizeBytes).toBe(PNG_BYTES.byteLength);
    expect(meta.savedAt.length).toBeGreaterThan(0);

    const attachment = await db.getAttachment(result.attachmentId);
    expect(attachment).toMatchObject({
      orgId: "org_1",
      profileId: "profile_1",
      sessionId: "session_1",
      channel: "web",
      kind: "image",
      mediaType: "image/png",
      sizeBytes: PNG_BYTES.byteLength,
    });
    expect(usage).toEqual([{ model: "gpt-image-2", input: 8, output: 200 }]);
  });

  test("filename collision gets unique suffix and remapped sidecar pairs on disk", async () => {
    await setupWorkspace();
    const db = createInMemoryDatabaseAdapter();
    const artifactsDir = path.join(workspaceRoot, "artifacts");
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(path.join(artifactsDir, "cat.png"), "existing");

    const result = await runGenerateImageTool(
      { prompt: "a cat", filename: "cat.png" },
      {
        orgId: "org_1",
        profileId: "profile_1",
        sessionId: "session_1",
        channel: "web",
        workspaceRoot,
      },
      {
        db,
        getUserConfig: () => openaiConfig({ imageModel: IMAGE_GENERATION_SELECTION }),
        ensureSettingsLoaded: async () => {},
        generateImage: async () => ({
          mediaType: "image/png",
          data: PNG_BYTES,
          model: "gpt-image-2",
          size: "1024x1024",
        }),
      },
    );

    expect("path" in result).toBe(true);
    if (!("path" in result)) {
      throw new Error("expected success");
    }
    expect(result.path).not.toBe("artifacts/cat.png");
    expect(result.path.startsWith("artifacts/cat-")).toBe(true);
    expect(result.path.endsWith(".png")).toBe(true);

    const absolute = path.join(workspaceRoot, result.path);
    expect(await readFile(absolute)).toEqual(Buffer.from(PNG_BYTES));
    const meta = JSON.parse(await readFile(`${absolute}.nakama-meta.json`, "utf8")) as {
      mimeType: string;
    };
    expect(meta.mimeType).toBe("image/png");
  });

  test("unset model returns error and writes no files (AE2)", async () => {
    await setupWorkspace();
    const db = createInMemoryDatabaseAdapter();
    let attachmentInserts = 0;
    const originalInsert = db.insertAttachment.bind(db);
    db.insertAttachment = async (record) => {
      attachmentInserts += 1;
      return originalInsert(record);
    };

    const result = await runGenerateImageTool(
      { prompt: "a cat" },
      {
        orgId: "org_1",
        profileId: "profile_1",
        sessionId: "session_1",
        channel: "web",
        workspaceRoot,
      },
      {
        db,
        getUserConfig: () => openaiConfig({ imageModel: null }),
        ensureSettingsLoaded: async () => {},
        generateImage: async () => {
          throw new Error("should not call OpenAI");
        },
      },
    );

    expect(result).toEqual({ error: IMAGE_MODEL_REQUIRED_MESSAGE });
    const artifactsDir = path.join(workspaceRoot, "artifacts");
    const entries = await readdir(artifactsDir).catch(() => [] as string[]);
    expect(entries).toEqual([]);
    expect(attachmentInserts).toBe(0);
  });

  test("OpenAI failure writes no partial sidecar or attachment", async () => {
    await setupWorkspace();
    const db = createInMemoryDatabaseAdapter();
    let attachmentInserts = 0;
    const originalInsert = db.insertAttachment.bind(db);
    db.insertAttachment = async (record) => {
      attachmentInserts += 1;
      return originalInsert(record);
    };

    const result = await runGenerateImageTool(
      { prompt: "a cat" },
      {
        orgId: "org_1",
        profileId: "profile_1",
        sessionId: "session_1",
        channel: "web",
        workspaceRoot,
      },
      {
        db,
        getUserConfig: () => openaiConfig({ imageModel: IMAGE_GENERATION_SELECTION }),
        ensureSettingsLoaded: async () => {},
        generateImage: async () => {
          throw new Error("upstream failed");
        },
      },
    );

    expect("error" in result).toBe(true);
    const entries = await readdir(path.join(workspaceRoot, "artifacts")).catch(() => [] as string[]);
    expect(entries).toEqual([]);
    expect(attachmentInserts).toBe(0);
  });

  test("tool result includes path, mimeType, sizeBytes, attachmentId, model", async () => {
    await setupWorkspace();
    const db = createInMemoryDatabaseAdapter();

    const result = await runGenerateImageTool(
      { prompt: "logo" },
      {
        orgId: "org_1",
        profileId: "profile_1",
        sessionId: "session_1",
        channel: "cli",
        workspaceRoot,
      },
      {
        db,
        getUserConfig: () => openaiConfig({ imageModel: IMAGE_GENERATION_SELECTION }),
        ensureSettingsLoaded: async () => {},
        generateImage: async () => ({
          mediaType: "image/png",
          data: PNG_BYTES,
          model: "gpt-image-2",
          size: "1024x1024",
        }),
      },
    );

    expect(Object.keys(result).sort()).toEqual([
      "attachmentId",
      "mimeType",
      "model",
      "path",
      "sizeBytes",
    ]);
    expect(result).toMatchObject({
      mimeType: "image/png",
      sizeBytes: PNG_BYTES.byteLength,
      model: "gpt-image-2",
    });
  });
});
