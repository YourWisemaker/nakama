import { describe, expect, test } from "bun:test";
import { NakamaApiError, type UserConfig } from "@nakama/core";
import { createInMemoryDatabaseAdapter, WORKSPACE_SETTINGS_ID } from "@nakama/db";
import { IMAGE_GENERATION_SELECTION } from "../providers/models";
import { AgentService } from "./agent-service";
import {
  fallbackImageGenerationTokens,
  generateImageWithOpenAI,
  normalizeImageGenerationSize,
  resolveImageGenerationSelection,
  resolveImageGenerationTokens,
} from "./image-generation";

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

describe("resolveImageGenerationSelection", () => {
  test("returns null when image model is not configured", () => {
    expect(resolveImageGenerationSelection(openaiConfig())).toBeNull();
  });

  test("resolves allowlisted openai::gpt-image-2 selection", () => {
    const resolved = resolveImageGenerationSelection(
      openaiConfig({ imageModel: IMAGE_GENERATION_SELECTION }),
    );
    expect(resolved?.model).toBe("gpt-image-2");
    expect(resolved?.selection).toBe(IMAGE_GENERATION_SELECTION);
    expect(resolved?.apiKey).toBe("test-key");
    expect(resolved?.instance.id).toBe("p-openai");
  });

  test("rejects non-allowlisted selection", () => {
    expect(() =>
      resolveImageGenerationSelection(
        openaiConfig({ imageModel: "openai::dall-e-3" }),
      ),
    ).toThrow(NakamaApiError);
  });

  test("fails when OpenAI API key is missing", () => {
    expect(() =>
      resolveImageGenerationSelection(
        openaiConfig({
          imageModel: IMAGE_GENERATION_SELECTION,
          providers: [
            {
              id: "p-openai",
              type: "openai",
              label: "OpenAI",
              apiKey: "",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
        {},
      ),
    ).toThrow(NakamaApiError);
  });
});

describe("normalizeImageGenerationSize / token helpers", () => {
  test("defaults size and rejects unknown sizes", () => {
    expect(normalizeImageGenerationSize(undefined)).toBe("1024x1024");
    expect(() => normalizeImageGenerationSize("512x512")).toThrow(NakamaApiError);
  });

  test("maps API usage tokens when present", () => {
    expect(
      resolveImageGenerationTokens("hello", "1024x1024", {
        input_tokens: 12,
        output_tokens: 200,
      }),
    ).toEqual({ inputTokens: 12, outputTokens: 200 });
  });

  test("falls back when usage is missing", () => {
    const fallback = fallbackImageGenerationTokens("abcd", "1024x1024");
    expect(fallback.inputTokens).toBe(1);
    expect(fallback.outputTokens).toBe(200);
    expect(
      resolveImageGenerationTokens("abcd", "1024x1024", undefined),
    ).toEqual(fallback);
  });
});

describe("generateImageWithOpenAI", () => {
  test("rejects empty prompt before fetch", async () => {
    await expect(
      generateImageWithOpenAI({ prompt: "  ", apiKey: "test-key" }),
    ).rejects.toThrow(NakamaApiError);
  });

  test("rejects non-gpt-image-2 model before fetch", async () => {
    await expect(
      generateImageWithOpenAI({
        prompt: "a cat",
        apiKey: "test-key",
        model: "dall-e-3",
      }),
    ).rejects.toThrow(NakamaApiError);
  });
});

describe("AgentService image generation settings", () => {
  test("round-trips allowlisted model and clears with null", async () => {
    const db = createInMemoryDatabaseAdapter();
    const service = new AgentService(openaiConfig(), null, db);

    const saved = await service.setImageGenerationSettings({
      model: IMAGE_GENERATION_SELECTION,
    });
    expect(saved).toEqual({
      imageGeneration: { model: IMAGE_GENERATION_SELECTION },
    });
    expect(await db.getWorkspaceSettings()).toMatchObject({
      imageModel: IMAGE_GENERATION_SELECTION,
    });
    expect(await service.getImageGenerationSettings()).toEqual({
      imageGeneration: { model: IMAGE_GENERATION_SELECTION },
    });

    const cleared = await service.setImageGenerationSettings({ model: null });
    expect(cleared).toEqual({ imageGeneration: { model: null } });
    expect(await db.getWorkspaceSettings()).toMatchObject({ imageModel: null });
  });

  test("rejects non-allowlisted PUT and leaves stored model unchanged (AE1)", async () => {
    const db = createInMemoryDatabaseAdapter();
    await db.upsertWorkspaceSettings({
      id: WORKSPACE_SETTINGS_ID,
      visionModel: null,
      transcriptionModel: null,
      imageModel: IMAGE_GENERATION_SELECTION,
      codingAgentHarnesses: [],
      selectedCodingAgentHarness: null,
      updatedAt: new Date().toISOString(),
    });

    const service = new AgentService(
      openaiConfig({ imageModel: IMAGE_GENERATION_SELECTION }),
      null,
      db,
    );

    await expect(
      service.setImageGenerationSettings({ model: "openai::dall-e-3" }),
    ).rejects.toThrow(NakamaApiError);

    expect(await db.getWorkspaceSettings()).toMatchObject({
      imageModel: IMAGE_GENERATION_SELECTION,
    });
    expect(await service.getImageGenerationSettings()).toEqual({
      imageGeneration: { model: IMAGE_GENERATION_SELECTION },
    });
  });
});
