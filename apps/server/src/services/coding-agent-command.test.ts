import { describe, expect, test } from "bun:test";
import type { CodingAgentProviderRouting } from "./coding-agent-provider-routing";
import {
  buildCodingAgentCommandTemplate,
  formatCodingAgentCommandContext,
} from "./coding-agent-command";

const inactiveRouting: CodingAgentProviderRouting = {
  workspaceEnabled: true,
  configured: false,
  compatible: false,
  active: false,
  providerType: null,
  providerLabel: null,
  baseUrl: null,
  apiKey: null,
  model: null,
  apiShape: null,
  error: null,
};

const activeRouting: CodingAgentProviderRouting = {
  workspaceEnabled: true,
  configured: true,
  compatible: true,
  active: true,
  providerType: "anthropic",
  providerLabel: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  apiKey: "sk-ant-test",
  model: "claude-sonnet-4-6",
  apiShape: "anthropic_messages",
  error: null,
};

describe("buildCodingAgentCommandTemplate", () => {
  test("builds Claude Code print-mode command", async () => {
    const template = await buildCodingAgentCommandTemplate(
      {
        kind: "claude_code",
        name: "Claude Code",
        command: "claude",
        args: [],
      },
      "Add tests for auth",
      "/tmp/workspace",
      inactiveRouting,
    );

    expect(template.command).toContain("claude");
    expect(template.command).toContain("--print");
    expect(template.command).toContain("--permission-mode");
    expect(template.command).toContain("bypassPermissions");
    expect(template.command).toContain("'Add tests for auth'");
  });

  test("builds Codex exec command", async () => {
    const template = await buildCodingAgentCommandTemplate(
      {
        kind: "codex",
        name: "Codex",
        command: "codex",
        args: [],
      },
      "Refactor auth module",
      "/tmp/workspace",
      inactiveRouting,
    );

    expect(template.command).toContain("codex exec");
    expect(template.command).toContain("--skip-git-repo-check");
    expect(template.command).toContain("'Refactor auth module'");
  });

  test("builds OpenCode run command with workspace dir", async () => {
    const template = await buildCodingAgentCommandTemplate(
      {
        kind: "opencode",
        name: "OpenCode",
        command: "opencode",
        args: [],
      },
      "Fix lint errors",
      "/tmp/workspace",
      inactiveRouting,
    );

    expect(template.command).toContain("opencode run");
    expect(template.command).toContain("--dir");
    expect(template.command).toContain("'/tmp/workspace'");
    expect(template.command).toContain("--dangerously-skip-permissions");
    expect(template.command).toContain("'Fix lint errors'");
  });

  test("reflects custom harness command from workspace settings", async () => {
    const template = await buildCodingAgentCommandTemplate(
      {
        kind: "claude_code",
        name: "Custom Claude",
        command: "/opt/bin/claude",
        args: ["--model", "sonnet"],
      },
      "Touch README",
      "/tmp/workspace",
      inactiveRouting,
    );

    expect(template.command.startsWith("/opt/bin/claude --model sonnet")).toBe(true);
  });
});

describe("formatCodingAgentCommandContext", () => {
  test("formats harness context for bash delegation", async () => {
    const context = formatCodingAgentCommandContext(
      await buildCodingAgentCommandTemplate(
        {
          kind: "opencode",
          name: "OpenCode",
          command: "opencode",
          args: [],
        },
        "Ship feature",
        "/tmp/workspace",
        inactiveRouting,
      ),
    );

    expect(context).toContain("bash");
    expect(context).toContain("opencode run");
  });

  test("redacts API keys from prompt context", async () => {
    const context = formatCodingAgentCommandContext(
      await buildCodingAgentCommandTemplate(
        {
          kind: "claude_code",
          name: "Claude Code",
          command: "claude",
          args: [],
        },
        "Ship feature",
        "/tmp/workspace",
        activeRouting,
      ),
    );

    expect(context).toContain("Nakama provider passthrough");
    expect(context).not.toContain("sk-ant-test");
    expect(context).toContain('"***"');
  });
});
