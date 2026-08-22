import { describe, expect, test } from "bun:test";
import { splitComposerErrorOnSettings } from "./chat-composer-error";

describe("splitComposerErrorOnSettings", () => {
  test("splits so Settings can be a link", () => {
    expect(
      splitComposerErrorOnSettings(
        "This model cannot see images. Configure an image parsing model in Settings before sending images."
      )
    ).toEqual({
      after: " before sending images.",
      before:
        "This model cannot see images. Configure an image parsing model in ",
    });
  });

  test("splits the shorter Update it in Settings errors too", () => {
    expect(
      splitComposerErrorOnSettings(
        "Configured image parsing model is invalid. Update it in Settings."
      )
    ).toEqual({
      after: ".",
      before: "Configured image parsing model is invalid. Update it in ",
    });
  });

  test("leaves messages without Settings as plain text", () => {
    expect(
      splitComposerErrorOnSettings("Choose a vision-capable model.")
    ).toEqual({
      after: null,
      before: "Choose a vision-capable model.",
    });
  });
});
