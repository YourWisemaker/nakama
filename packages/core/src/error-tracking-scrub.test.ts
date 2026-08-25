import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { scrubText } from "./error-tracking-scrub";

/**
 * These assert the negative side: given a payload that carries real secrets, none of
 * them may survive. A crash report leaves the user's machine and carries their org's
 * data, so a regression here is a third-party data incident, not a telemetry bug.
 */
describe("scrubText removes credentials", () => {
  // The secret is carried per case. Asserting all eight in every case reads as
  // thorough and is not: seven of them were never in that input, so those
  // assertions pass whatever scrubText does.
  const cases: Array<[name: string, secret: string, message: string]> = [
    [
      "anthropic key",
      "sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345",
      "failed with SECRET",
    ],
    [
      "openai key",
      "sk-proj-AAAABBBBCCCCDDDDEEEEFFFF",
      "Authorization header SECRET",
    ],
    [
      "github token",
      "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      "clone failed SECRET",
    ],
    ["slack token", "xoxb-1234567890-ABCDEFGHIJKL", "post failed SECRET"],
    ["aws key id", "AKIAIOSFODNN7EXAMPLE", "denied for SECRET"],
    [
      "bearer header",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "Authorization: Bearer SECRET",
    ],
    ["assignment", "hunter2secretvalue", 'connect({ apiKey: "SECRET" })'],
    ["env style", "abcd1234efgh5678", "ANTHROPIC_TOKEN=SECRET"],
  ];

  for (const [name, secret, message] of cases) {
    test(name, () => {
      const input = message.replace("SECRET", secret);

      expect(input).toContain(secret);
      expect(scrubText(input)).not.toContain(secret);
    });
  }
});

test("scrubText removes email addresses", () => {
  const scrubbed = scrubText("owner alice@example.com could not be notified");

  expect(scrubbed).not.toContain("alice@example.com");
  expect(scrubbed).toContain("<email>");
});

test("scrubText replaces the home directory with a tilde", () => {
  const scrubbed = scrubText(`ENOENT at ${homedir()}/.nakama/config.ini`);

  expect(scrubbed).not.toContain(homedir());
  expect(scrubbed).toContain("~/.nakama/config.ini");
});

test("scrubText replaces home paths belonging to another user", () => {
  const scrubbed = scrubText(
    "read failed: /Users/someoneelse/.nakama/orgs/a.db"
  );

  expect(scrubbed).not.toContain("someoneelse");
  expect(scrubbed).toContain("~/.nakama/orgs/a.db");
});

test("scrubText keeps the diagnostic parts of a stack frame", () => {
  const scrubbed = scrubText(
    "TypeError: cannot read tools at resolveTools (~/src/a.ts:12:3)"
  );

  expect(scrubbed).toContain("TypeError");
  expect(scrubbed).toContain("resolveTools");
  expect(scrubbed).toContain("a.ts:12:3");
});

describe("scrubText removes the data an error message quotes back", () => {
  test("a printed JSON payload does not survive", () => {
    const scrubbed = scrubText(
      'Unexpected token in {"name":"Budi","email":"budi@klinik.example","age":34}'
    );

    expect(scrubbed).not.toContain("Budi");
    expect(scrubbed).not.toContain("klinik");
    expect(scrubbed).toContain("Unexpected token in");
  });

  test("a nested payload does not survive either", () => {
    const scrubbed = scrubText(
      'failed on {"patient":{"name":"Budi","room":"A1"}}'
    );

    expect(scrubbed).not.toContain("Budi");
    expect(scrubbed).not.toContain("A1");
  });

  test("a rejected value in double quotes does not survive", () => {
    const scrubbed = scrubText('Invalid value "Budi" for field name');

    expect(scrubbed).not.toContain("Budi");
    expect(scrubbed).toContain("for field name");
  });

  test("a printed row does not survive", () => {
    const scrubbed = scrubText("constraint failed for ['Budi', 34, 'jakarta']");

    expect(scrubbed).not.toContain("Budi");
    expect(scrubbed).not.toContain("jakarta");
  });

  test("single-quoted identifiers stay readable, which is the whole trade", () => {
    expect(scrubText("Cannot find module 'error-tracking'")).toContain(
      "'error-tracking'"
    );
    expect(
      scrubText("Cannot read property 'sessionId' of undefined")
    ).toContain("'sessionId'");
  });

  test("an apostrophe in prose is not treated as a quote", () => {
    const scrubbed = scrubText("the worker didn't start and it's still down");

    expect(scrubbed).toBe("the worker didn't start and it's still down");
  });
});

test("scrubText truncates runaway text", () => {
  const scrubbed = scrubText("x".repeat(10_000));

  expect(scrubbed.length).toBeLessThanOrEqual(4001);
});
