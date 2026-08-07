import type { ToolContext, ToolDefinition, UserConfig } from "@nakama/core";
import type { DatabaseAdapter } from "@nakama/db";
import {
  IMAGE_GENERATION_SIZES,
  IMAGE_MODEL_REQUIRED_MESSAGE,
  resolveImageGenerationSelection,
} from "../services/image-generation";

export const GENERATE_IMAGE_TOOL_NAME = "generate_image";

export interface GenerateImageToolInput {
  prompt: string;
  size?: string;
  filename?: string;
}

export interface GenerateImageToolSuccess {
  path: string;
  mimeType: string;
  sizeBytes: number;
  attachmentId: string | null;
  model: string;
}

export interface GenerateImageToolFailure {
  error: string;
}

export type GenerateImageToolOutput = GenerateImageToolSuccess | GenerateImageToolFailure;

export interface GenerateImageToolDeps {
  db: DatabaseAdapter;
  getUserConfig: () => UserConfig | null | undefined;
  ensureSettingsLoaded: () => Promise<void>;
  recordUsage?: (modelId: string, inputTokens: number, outputTokens: number) => void;
  /** Test seam — defaults to live OpenAI Images call. */
  generateImage?: (input: {
    prompt: string;
    size?: string;
    apiKey: string;
    model: string;
  }) => Promise<{
    mediaType: string;
    data: Uint8Array;
    model: string;
    size: string;
    usage?: { inputTokens: number; outputTokens: number };
  }>;
}

export function createGenerateImageTool(deps: GenerateImageToolDeps): ToolDefinition {
  return {
    name: GENERATE_IMAGE_TOOL_NAME,
    description:
      "Generate an image from a text prompt using the workspace image model (OpenAI gpt-image-2). Saves a PNG under artifacts/ with a metadata sidecar and session attachment when available. Model is configured in Settings — do not pass a model name.",
    parallelSafe: false,
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the image to generate.",
        },
        size: {
          type: "string",
          description: `Optional image size. Allowed: ${IMAGE_GENERATION_SIZES.join(", ")}.`,
        },
        filename: {
          type: "string",
          description:
            "Optional output filename under artifacts/ (defaults to a generated .png name).",
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async run(input, context) {
      return runGenerateImageTool(input, context, deps);
    },
  };
}

/**
 * U3: seed/resolver wiring + fail-closed when image model unset.
 * U4 fills in Images API call, artifact/sidecar write, and attachment persistence.
 */
export async function runGenerateImageTool(
  input: unknown,
  context: ToolContext,
  deps: GenerateImageToolDeps,
): Promise<GenerateImageToolOutput> {
  const prompt = readString(input, "prompt")?.trim();
  if (!prompt) {
    return { error: "prompt is required." };
  }

  // Reject caller-supplied model even if present in raw input.
  if (hasOwnKey(input, "model")) {
    return { error: "model is not a generate_image parameter; configure it in Settings." };
  }

  const orgId = context.orgId?.trim();
  const profileId = context.profileId?.trim();
  if (!orgId || !profileId) {
    return { error: "orgId and profileId are required." };
  }

  await deps.ensureSettingsLoaded();
  const selection = resolveImageGenerationSelection(deps.getUserConfig());

  if (!selection) {
    return { error: IMAGE_MODEL_REQUIRED_MESSAGE };
  }

  void context;
  void deps.db;
  return {
    error: "Image generation persistence is not available yet.",
  };
}

function hasOwnKey(input: unknown, key: string): boolean {
  return typeof input === "object" && input !== null && Object.prototype.hasOwnProperty.call(input, key);
}

function readString(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return null;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
