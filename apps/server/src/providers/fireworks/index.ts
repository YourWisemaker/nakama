import type { CustomModelEntry, ProviderClient } from "@nakama/core";
import { compatibleModelSupportsThinking } from "../compatible-models";
import { createOpenAICompatibleProvider } from "../openai-compatible";

export const FIREWORKS_INFERENCE_BASE_URL =
  "https://api.fireworks.ai/inference/v1";

export interface FireworksProviderOptions {
  apiKey: string;
  customModels?: CustomModelEntry[];
  model: string;
}

export function createFireworksProvider(
  options: FireworksProviderOptions
): ProviderClient {
  return createOpenAICompatibleProvider({
    apiKey: options.apiKey,
    baseUrl: FIREWORKS_INFERENCE_BASE_URL,
    displayName: "Fireworks",
    model: options.model,
    providerName: "fireworks",
    supportsThinking: compatibleModelSupportsThinking(
      options.model,
      options.customModels
    ),
  });
}
