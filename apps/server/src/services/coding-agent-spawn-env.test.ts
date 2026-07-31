import { describe, expect, test } from "bun:test";
import {
  buildClaudeCodeSpawnEnv,
  buildCodexSpawnEnv,
  mergeCodingAgentSpawnEnv,
  normalizeCodingAgentModel,
  redactSpawnEnvForPrompt,
} from "./coding-agent-spawn-env";

describe("coding-agent spawn env", () => {
  test("normalizes profile model ids", () => {
    expect(normalizeCodingAgentModel("anthropic:claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
    expect(normalizeCodingAgentModel("anthropic/claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });

  test("returns no env overrides when routing is inactive", () => {
    expect(
      buildClaudeCodeSpawnEnv({
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
      }),
    ).toEqual({});
  });

  test("builds Claude Code provider passthrough env", () => {
    const env = buildClaudeCodeSpawnEnv(
      {
        workspaceEnabled: true,
        configured: true,
        compatible: true,
        active: true,
        providerType: "anthropic",
        providerLabel: "Anthropic",
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk-ant-test",
        model: "anthropic:claude-opus-4-6",
        apiShape: "anthropic_messages",
        error: null,
      },
      "anthropic",
    );

    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.anthropic.com");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("claude-opus-4-6");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
  });

  test("builds Codex provider passthrough env", () => {
    expect(
      buildCodexSpawnEnv(
        {
          workspaceEnabled: true,
          configured: true,
          compatible: true,
          active: true,
          providerType: "openai",
          providerLabel: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-openai-test",
          model: "openai:gpt-4.1",
          apiShape: "openai_chat",
          error: null,
        },
        "openai",
      ),
    ).toEqual({
      OPENAI_API_KEY: "sk-openai-test",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-4.1",
    });
  });

  test("protects credential env keys from caller overrides", () => {
    const env = mergeCodingAgentSpawnEnv(
      { HOME: "/tmp" },
      {
        ANTHROPIC_API_KEY: "sk-from-nakama",
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
      },
      {
        protectCredentialKeys: true,
        callerEnv: {
          ANTHROPIC_API_KEY: "sk-override",
          CUSTOM_FLAG: "1",
        },
      },
    );

    expect(env.ANTHROPIC_API_KEY).toBe("sk-from-nakama");
    expect(env.CUSTOM_FLAG).toBe("1");
  });

  test("redacts secrets for prompt context", () => {
    expect(
      redactSpawnEnvForPrompt({
        ANTHROPIC_API_KEY: "sk-ant-test",
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        OPENAI_MODEL: "gpt-4.1",
      }),
    ).toEqual({
      ANTHROPIC_API_KEY: "***",
      ANTHROPIC_BASE_URL: "https://api.anthropic.com",
      OPENAI_MODEL: "gpt-4.1",
    });
  });
});
