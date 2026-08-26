import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolContext, ToolDefinition } from "@nakama/core";
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

const PYTHON_BIN = process.env.NAKAMA_PYTHON_BIN ?? "python3";
const DEFAULT_TIMEOUT_MS = 30_000;

// Call-time env override so tests can shrink the kill timer.
function resolveTimeoutMs(): number {
  const configured = Number(process.env.NAKAMA_PYTHON_TOOL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

export async function loadPythonTool(
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
    modulePath = resolvePythonModulePath(config.modulePath);
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
    await validatePythonToolModule(config.modulePath);
  } catch (error) {
    return createErrorTool(
      record,
      error instanceof Error ? error.message : String(error)
    );
  }

  const parameters = config.parameters ?? permissiveObjectSchema();

  return {
    description: record.description,
    name: record.name,
    parameters,
    async run(input, context) {
      return runPythonTool(modulePath, input, context);
    },
  };
}

export async function validatePythonToolModule(
  modulePath: string
): Promise<void> {
  const resolvedPath = resolvePythonModulePath(modulePath);

  if (!(await pathExists(resolvedPath))) {
    throw new Error(`Tool module not found: ${modulePath}`);
  }

  // Static checks catch the obvious authoring failures before registration.
  // Syntax errors still surface at invocation.
  const source = await readFile(resolvedPath, "utf8");

  if (!/\bdef\s+run\s*\(/.test(source)) {
    throw new Error("Tool module must define a run(input, context) function.");
  }

  const hasHarness =
    /if\s+__name__\s*==\s*["']__main__["']\s*:/.test(source) &&
    source.includes("sys.stdin") &&
    source.includes("sys.stdout");
  if (!hasHarness) {
    throw new Error(
      'Python tools must include an if __name__ == "__main__" harness that reads JSON from sys.stdin and writes JSON to sys.stdout.'
    );
  }
}

export function resolvePythonModulePath(modulePath: string): string {
  return resolveCustomToolModulePath(modulePath);
}

async function runPythonTool(
  modulePath: string,
  input: unknown,
  context: ToolContext
): Promise<unknown> {
  const env = buildAllowlistedSubprocessEnv(
    readString(context?.workspaceRoot) || undefined
  );

  // No try/catch here on purpose: a failed spawn must reject so the retry
  // policy in withToolRetries can retry transient failures. executeToolCall
  // (packages/agent/src/tool-loop.ts) converts the throw into the same
  // `{ error: message }` shape callers already expect.
  return spawnJsonTool({
    args: [modulePath],
    bin: PYTHON_BIN,
    context,
    cwd: path.dirname(modulePath),
    env,
    input,
    label: "Python tool",
    timeoutMs: resolveTimeoutMs(),
  });
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
