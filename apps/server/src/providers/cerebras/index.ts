import type { CustomModelEntry, ProviderClient } from "@nakama/core";
import { compatibleModelSupportsThinking } from "../compatible-models";
import { createOpenAICompatibleProvider } from "../openai-compatible";

export const CEREBRAS_CHAT_BASE_URL = "https://api.cerebras.ai/v1";

export interface CerebrasProviderOptions {
  apiKey: string;
  customModels?: CustomModelEntry[];
  model: string;
}

export function createCerebrasProvider(
  options: CerebrasProviderOptions
): ProviderClient {
  return createOpenAICompatibleProvider({
    apiKey: options.apiKey,
    baseUrl: CEREBRAS_CHAT_BASE_URL,
    displayName: "Cerebras",
    model: options.model,
    providerName: "cerebras",
    supportsThinking: compatibleModelSupportsThinking(
      options.model,
      options.customModels
    ),
  });
}
