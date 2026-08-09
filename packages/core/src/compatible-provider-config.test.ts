import { describe, expect, test } from "bun:test";
import {
  isValidBaseUrl,
  normalizeBaseUrl,
  validateCustomModels,
} from "./compatible-provider-config";

describe("normalizeBaseUrl", () => {
  test("preserves path segments and strips trailing slashes", () => {
    expect(normalizeBaseUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1"
    );
    expect(normalizeBaseUrl("http://localhost:8000/v1/")).toBe(
      "http://localhost:8000/v1"
    );
    expect(normalizeBaseUrl("  https://gateway.devscale.id/v1  ")).toBe(
      "https://gateway.devscale.id/v1"
    );
  });

  test("keeps pathless origins unchanged aside from trailing slash", () => {
    expect(normalizeBaseUrl("https://api.example.com")).toBe(
      "https://api.example.com"
    );
    expect(normalizeBaseUrl("https://api.example.com/")).toBe(
      "https://api.example.com"
    );
  });
});

describe("isValidBaseUrl", () => {
  test("accepts http(s) URLs with path segments", () => {
    expect(isValidBaseUrl("https://api.example.com/v1")).toBe(true);
    expect(isValidBaseUrl("http://localhost:8000/v1")).toBe(true);
  });

  test("rejects non-http(s) schemes", () => {
    expect(isValidBaseUrl("ftp://api.example.com/v1")).toBe(false);
    expect(isValidBaseUrl("not-a-url")).toBe(false);
  });
});

describe("validateCustomModels", () => {
  test("accepts supportsThinking when it is boolean", () => {
    const models = validateCustomModels([
      {
        default: true,
        id: "qwen3.6-35b",
        name: "Qwen 3.6 35B",
        supportsThinking: true,
      },
    ]);

    expect(models[0]?.supportsThinking).toBe(true);
  });

  test("rejects non-boolean supportsThinking values", () => {
    expect(() =>
      validateCustomModels([
        {
          id: "qwen3.6-35b",
          supportsThinking: "yes",
        },
      ])
    ).toThrow('Model "qwen3.6-35b" has invalid supportsThinking flag.');
  });
});
