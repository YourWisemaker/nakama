import { readFile } from "node:fs/promises";
import path from "node:path";
import type { JsonSchema, ToolContext, ToolDefinition } from "@nakama/core";
import { pathExists, permissiveObjectSchema } from "@nakama/core";
import type { StoredToolRecord } from "@nakama/db";
import {
  createErrorTool,
  readHandlerConfig,
  resolveCustomToolModulePath,
} from "./custom-tool-shared";
import {
  buildAllowlistedSubprocessEnv,
  spawnJsonTool,
} from "./custom-tool-subprocess";

const BUN_BIN = process.env.NAKAMA_BUN_BIN ?? "bun";
const DEFAULT_TIMEOUT_MS = 30_000;

// Call-time env override so tests can shrink the kill timer.
function resolveTimeoutMs(): number {
  const configured = Number(process.env.NAKAMA_JAVASCRIPT_TOOL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

export async function loadJavascriptTool(
  record: StoredToolRecord
): Promise<ToolDefinition | null> {
  const config = readHandlerConfig(record.handlerConfig);

  if (!config?.modulePath) {
    return createErrorTool(
      record,
      `Tool "${record.name}" is missing handlerConfig.modulePath.`
    );
  }

  let modulePath: string;

  try {
    modulePath = resolveJavascriptModulePath(config.modulePath);
  } catch (error) {
    return createErrorTool(
      record,
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!(await pathExists(modulePath))) {
    return createErrorTool(
      record,
      `Tool module not found: ${config.modulePath}`
    );
  }

  // Surface the missing-`run` error at load time so the agent sees a clear
  // message instead of a confusing JSON parse error from spawn.
  try {
    await validateJavascriptToolModule(config.modulePath);
  } catch (error) {
    return createErrorTool(
      record,
      error instanceof Error ? error.message : String(error)
    );
  }

  const parameters: JsonSchema = config.parameters ?? permissiveObjectSchema();

  return {
    description: record.description,
    name: record.name,
    parameters,
    ...(config.parallelSafe ? { parallelSafe: true } : {}),
    async run(input, context) {
      return runJavascriptTool(modulePath, input, context);
    },
  };
}

export async function validateJavascriptToolModule(
  modulePath: string
): Promise<void> {
  const resolvedPath = resolveJavascriptModulePath(modulePath);

  if (!(await pathExists(resolvedPath))) {
    throw new Error(`Tool module not found: ${modulePath}`);
  }

  // Static checks catch the obvious authoring failures before registration.
  // Syntax errors still surface at invocation.
  const source = await readFile(resolvedPath, "utf8");

  if (!/\bfunction\s+run\s*\(|\b(?:const|let|var)\s+run\s*=/.test(source)) {
    throw new Error("Tool module must define a run(input, context) function.");
  }

  const hasHarness =
    /import\.meta\.main/.test(source) &&
    /stdin/i.test(source) &&
    /stdout/i.test(source);
  if (!hasHarness) {
    throw new Error(
      "JavaScript tools must include an if (import.meta.main) harness that reads JSON from stdin and writes JSON to stdout."
    );
  }
}

export function resolveJavascriptModulePath(modulePath: string): string {
  return resolveCustomToolModulePath(modulePath);
}

async function runJavascriptTool(
  modulePath: string,
  input: unknown,
  context: ToolContext
): Promise<unknown> {
  const env = buildAllowlistedSubprocessEnv(
    readString(context?.workspaceRoot) || undefined
  );

  // No try/catch here on purpose, matching the Python loader: a failed spawn
  // must reject so the retry policy in withToolRetries can retry transient
  // failures. executeToolCall converts the throw into `{ error: message }`.
  return spawnJsonTool({
    args: [modulePath],
    bin: BUN_BIN,
    context,
    cwd: path.dirname(modulePath),
    env,
    input,
    label: "JavaScript tool",
    timeoutMs: resolveTimeoutMs(),
  });
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
