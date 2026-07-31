import type { UserConfig } from "@nakama/core";
import type { StoredCodingAgentHarnessKind } from "@nakama/db";
import { resolveCodingAgentProviderRouting } from "./coding-agent-provider-routing";
import {
  buildSpawnEnvForHarness,
  type CodingAgentSpawnEnvResult,
} from "./coding-agent-spawn-env";

export interface CodingAgentSpawnBundle {
  routing: ReturnType<typeof resolveCodingAgentProviderRouting>;
  spawn: CodingAgentSpawnEnvResult;
}

export async function resolveCodingAgentSpawnBundle(options: {
  userConfig: UserConfig | null | undefined;
  profileModel: string | null | undefined;
  harnessKind: StoredCodingAgentHarnessKind;
  workspacePassthroughEnabled?: boolean;
  env?: Record<string, string | undefined>;
}): Promise<CodingAgentSpawnBundle> {
  const routing = resolveCodingAgentProviderRouting({
    userConfig: options.userConfig,
    profileModel: options.profileModel,
    harnessKind: options.harnessKind,
    workspacePassthroughEnabled: options.workspacePassthroughEnabled,
    env: options.env,
  });

  const spawn = await buildSpawnEnvForHarness(
    options.harnessKind,
    routing,
    routing.providerType ?? "openai",
  );

  return { routing, spawn };
}
