import { describe, expect, test } from "bun:test";
import { composeSoulSystemPrompt } from "./compose";
import { SOUL_TEMPLATE } from "./templates";

describe("composeSoulSystemPrompt", () => {
  test("does not append Profile Instructions when profilePrompt is empty", () => {
    const prompt = composeSoulSystemPrompt(
      {
        directory: "/tmp",
        files: { soul: SOUL_TEMPLATE },
        loaded: ["SOUL.md"],
      },
      { profilePrompt: "" }
    );

    expect(prompt).not.toContain("# Profile Instructions");
  });

  test("appends Profile Instructions when profilePrompt differs from SOUL", () => {
    const prompt = composeSoulSystemPrompt(
      {
        directory: "/tmp",
        files: { soul: SOUL_TEMPLATE },
        loaded: ["SOUL.md"],
      },
      { profilePrompt: "Always respond in pirate speak." }
    );

    expect(prompt).toContain("# Profile Instructions");
    expect(prompt).toContain("Always respond in pirate speak.");
  });
});
