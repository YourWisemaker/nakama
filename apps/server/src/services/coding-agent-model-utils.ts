import type { ProviderName } from "@nakama/core";
import type { StoredCodingAgentHarnessKind } from "@nakama/db";

export function normalizeCodingAgentModel(model: string | null | undefined): string | null {
  if (!model?.trim()) {
    return null;
  }

  const trimmed = model.trim();
  const colonIndex = trimmed.indexOf(":");

  if (colonIndex >= 0) {
    const normalized = trimmed.slice(colonIndex + 1).trim();
    return normalized || null;
  }

  const slashIndex = trimmed.lastIndexOf("/");

  if (slashIndex >= 0) {
    const normalized = trimmed.slice(slashIndex + 1).trim();
    return normalized || null;
  }

  return trimmed;
}

export function formatModelForHarness(
  harnessKind: StoredCodingAgentHarnessKind,
  providerType: ProviderName,
  model: string,
): string {
  if (providerType === "openrouter" || providerType === "opencode_go") {
    return model.trim();
  }

  if (harnessKind === "claude_code" && providerType === "anthropic") {
    return normalizeCodingAgentModel(model) ?? model.trim();
  }

  return normalizeCodingAgentModel(model) ?? model.trim();
}
