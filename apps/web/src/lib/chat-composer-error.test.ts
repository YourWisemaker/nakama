import { describe, expect, test } from "bun:test";
import { composerErrorSegments } from "./chat-composer-error";

describe("composerErrorSegments", () => {
  test("turns Settings into a dedicated segment so the composer can link it", () => {
    expect(
      composerErrorSegments(
        "This model cannot see images. Configure an image parsing model in Settings before sending images."
      )
    ).toEqual([
      {
        type: "text",
        value:
          "This model cannot see images. Configure an image parsing model in ",
      },
      { type: "settings" },
      { type: "text", value: " before sending images." },
    ]);
  });

  test("links the shorter Update it in Settings errors too", () => {
    expect(
      composerErrorSegments(
        "Configured image parsing model is invalid. Update it in Settings."
      )
    ).toEqual([
      {
        type: "text",
        value: "Configured image parsing model is invalid. Update it in ",
      },
      { type: "settings" },
      { type: "text", value: "." },
    ]);
  });

  test("leaves messages without Settings as plain text", () => {
    expect(composerErrorSegments("Choose a vision-capable model.")).toEqual([
      { type: "text", value: "Choose a vision-capable model." },
    ]);
  });
});
