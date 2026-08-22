export type ComposerErrorSegment =
  | { type: "settings" }
  | { type: "text"; value: string };

export function composerErrorSegments(message: string): ComposerErrorSegment[] {
  const parts = message.split("Settings");
  const segments: ComposerErrorSegment[] = [];

  for (const [index, part] of parts.entries()) {
    if (part.length > 0) {
      segments.push({ type: "text", value: part });
    }

    if (index < parts.length - 1) {
      segments.push({ type: "settings" });
    }
  }

  return segments;
}
