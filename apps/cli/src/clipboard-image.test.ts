import { describe, expect, test } from "bun:test";
import { detectClipboardImageMediaType } from "./clipboard-image";

describe("detectClipboardImageMediaType", () => {
  test("detects png/jpeg/gif/webp magic bytes", () => {
    expect(
      detectClipboardImageMediaType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");

    expect(
      detectClipboardImageMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
    ).toBe("image/jpeg");

    expect(detectClipboardImageMediaType(Buffer.from("GIF89a", "ascii"))).toBe(
      "image/gif"
    );

    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");
    expect(detectClipboardImageMediaType(webp)).toBe("image/webp");
  });

  test("rejects unknown signatures", () => {
    expect(() =>
      detectClipboardImageMediaType(Buffer.from("not-an-image"))
    ).toThrow(/Unsupported clipboard image type/);
  });
});
