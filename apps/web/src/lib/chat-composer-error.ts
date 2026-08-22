export function splitComposerErrorOnSettings(message: string): {
  after: string | null;
  before: string;
} {
  const marker = "Settings";
  const offset = message.indexOf(marker);
  if (offset === -1) {
    return { after: null, before: message };
  }

  return {
    after: message.slice(offset + marker.length),
    before: message.slice(0, offset),
  };
}
