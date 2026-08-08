import type { ChannelArtifactRef } from "./channel-artifacts";

export interface DeliverableChannelArtifact extends ChannelArtifactRef {
  sharePath: string | null;
  shareUrl: string | null;
}

export interface PublishArtifactShareResult {
  refreshed: boolean;
  sharePath: string | null;
  shareUrl: string | null;
  webPublicUrlConfigured: boolean;
}

const ATTACH_NOUN =
  "file|document|attachment|artifact|pdf|csv|zip|image|photo|screenshot|report|deck";

const ATTACH_FILE_EXTENSIONS =
  "pdf|csv|tsv|png|jpe?g|gif|webp|zip|txt|md|markdown|json|docx|html?";

const ATTACH_EXTENSION_HINTS = new Set([
  "pdf",
  "csv",
  "tsv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "zip",
  "txt",
  "md",
  "markdown",
  "json",
  "docx",
  "html",
  "htm",
  "image",
  "photo",
  "screenshot",
  "report",
  "deck",
]);

const ATTACH_INTENT_PATTERNS = [
  new RegExp(
    String.raw`\b(?:send|attach|share)\s+(?:me\s+)?(?:the\s+)?(?:${ATTACH_NOUN})\b`,
    "i"
  ),
  // "send the pitch deck pdf file" — allow a few words between determiner and noun
  new RegExp(
    String.raw`\b(?:send|attach|share)\s+(?:me\s+)?(?:the\s+)?(?:\S+\s+){1,6}(?:${ATTACH_NOUN})\b`,
    "i"
  ),
  new RegExp(
    String.raw`\b(?:download|get)\s+(?:me\s+)?(?:the\s+)?(?:${ATTACH_NOUN})\b`,
    "i"
  ),
  new RegExp(
    String.raw`\b(?:download|get)\s+(?:me\s+)?(?:the\s+)?(?:\S+\s+){1,6}(?:${ATTACH_NOUN})\b`,
    "i"
  ),
  new RegExp(
    String.raw`\bsend\s+(?:me\s+)?(?:the\s+)?\S+\.(?:${ATTACH_FILE_EXTENSIONS})\b`,
    "i"
  ),
  /\battach\s+it\b/i,
  /\bsend\s+it(?:\s+here)?\b/i,
  /^\/attach(?:@\w+)?(?:\s|$)/i,
];

export interface ListedArtifactCandidate {
  /** Relative path under the profile artifacts dir (API read key). */
  filename: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface AttachArtifactHint {
  basename?: string;
  extension?: string;
}

export function isAttachIntent(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return ATTACH_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** True when the message is only the `/attach` shortcut (no agent turn needed). */
export function isAttachOnlyCommand(text: string): boolean {
  return /^\/attach(?:@\w+)?(?:\s|$)/i.test(text.trim());
}

export function extractAttachArtifactHint(
  text: string
): AttachArtifactHint | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const fileMatch = normalized.match(
    new RegExp(String.raw`\b([^\s/\\]+\.(?:${ATTACH_FILE_EXTENSIONS}))\b`, "i")
  );
  if (fileMatch?.[1]) {
    return { basename: fileMatch[1].toLowerCase() };
  }

  const typeMatch = normalized.match(
    new RegExp(
      String.raw`\b(?:the\s+)?(${[...ATTACH_EXTENSION_HINTS].join("|")})\b`,
      "i"
    )
  );
  if (!typeMatch?.[1]) {
    return null;
  }

  const token = typeMatch[1].toLowerCase();
  if (token === "image" || token === "photo" || token === "screenshot") {
    return { extension: "image" };
  }
  if (token === "report" || token === "deck") {
    return null;
  }
  if (token === "jpeg") {
    return { extension: "jpg" };
  }
  return { extension: token };
}

/**
 * Pick an artifact to attach: session registry first, then profile listing.
 * Registry is oldest→newest; listing is newest→oldest.
 */
export function resolveArtifactForAttach(input: {
  attachUserText: string;
  listed: ListedArtifactCandidate[];
  registry: DeliverableChannelArtifact[];
}): DeliverableChannelArtifact | null {
  const hint = extractAttachArtifactHint(input.attachUserText);

  const fromRegistry = pickArtifactCandidate(input.registry, hint, "last");
  if (fromRegistry) {
    return fromRegistry;
  }

  const listedDeliverable = input.listed.map((entry) =>
    listedCandidateToDeliverable(entry)
  );
  return pickArtifactCandidate(listedDeliverable, hint, "first");
}

export function formatMissingAttachArtifactMessage(): string {
  return "No saved artifact to attach. Save a file first, or name one like: send report.pdf";
}

function listedCandidateToDeliverable(
  entry: ListedArtifactCandidate
): DeliverableChannelArtifact {
  const basename = entry.filename.split(/[\\/]/).pop() ?? entry.filename;
  return {
    filename: basename,
    mimeType: entry.mimeType,
    path: entry.filename,
    savedAt: entry.updatedAt,
    sharePath: null,
    shareUrl: null,
    sizeBytes: entry.sizeBytes,
  };
}

function pickArtifactCandidate(
  candidates: DeliverableChannelArtifact[],
  hint: AttachArtifactHint | null,
  emptyHintPick: "first" | "last"
): DeliverableChannelArtifact | null {
  if (candidates.length === 0) {
    return null;
  }

  const ordered =
    emptyHintPick === "last" ? [...candidates].reverse() : candidates;

  if (hint?.basename) {
    const match = ordered.find((candidate) =>
      artifactMatchesBasename(candidate, hint.basename!)
    );
    if (match) {
      return match;
    }
  }

  if (hint?.extension) {
    const match = ordered.find((candidate) =>
      artifactMatchesExtension(candidate, hint.extension!)
    );
    if (match) {
      return match;
    }
  }

  return emptyHintPick === "last"
    ? (candidates.at(-1) ?? null)
    : (candidates[0] ?? null);
}

function artifactMatchesBasename(
  artifact: DeliverableChannelArtifact,
  basename: string
): boolean {
  const normalized = basename.toLowerCase();
  return (
    artifact.filename.toLowerCase() === normalized ||
    artifact.path.toLowerCase() === normalized ||
    artifact.path.toLowerCase().endsWith(`/${normalized}`)
  );
}

function artifactMatchesExtension(
  artifact: DeliverableChannelArtifact,
  extension: string
): boolean {
  const normalized = extension.toLowerCase();
  if (normalized === "image") {
    return /\.(png|jpe?g|gif|webp)$/i.test(artifact.filename);
  }
  if (normalized === "jpg") {
    return /\.jpe?g$/i.test(artifact.filename);
  }
  if (normalized === "md" || normalized === "markdown") {
    return /\.(md|markdown)$/i.test(artifact.filename);
  }
  if (normalized === "html" || normalized === "htm") {
    return /\.html?$/i.test(artifact.filename);
  }
  return artifact.filename.toLowerCase().endsWith(`.${normalized}`);
}

export function resolveShareUrlForPublish(
  response: PublishArtifactShareResult,
  cache: Record<string, string>,
  relativePath: string
): {
  shareUrl: string | null;
  sharePath: string | null;
  webPublicUrlConfigured: boolean;
} {
  if (response.shareUrl) {
    cache[relativePath] = response.shareUrl;
  }

  const shareUrl = response.shareUrl ?? cache[relativePath] ?? null;
  const sharePath =
    response.sharePath ||
    (shareUrl ? new URL(shareUrl, "http://localhost").pathname : null);

  return {
    sharePath,
    shareUrl,
    webPublicUrlConfigured: response.webPublicUrlConfigured,
  };
}

export function formatArtifactShareFooter(
  artifacts: Array<
    Pick<DeliverableChannelArtifact, "filename" | "shareUrl" | "sharePath">
  >,
  options: { webPublicUrlConfigured: boolean }
): string {
  const lines: string[] = [];

  for (const artifact of artifacts) {
    const link = artifact.shareUrl ?? artifact.sharePath;
    if (!link) {
      continue;
    }

    lines.push(`${artifact.filename}: ${link}`);
  }

  if (lines.length === 0) {
    return "";
  }

  if (!options.webPublicUrlConfigured) {
    lines.push(
      "Set Web Public URL in Nakama settings for absolute share links."
    );
  }

  return lines.join("\n");
}

export function pushDeliverableArtifact(
  registry: DeliverableChannelArtifact[],
  artifact: DeliverableChannelArtifact,
  maxEntries = 5
): DeliverableChannelArtifact[] {
  const withoutPath = registry.filter((entry) => entry.path !== artifact.path);
  const next = [...withoutPath, artifact];
  return next.slice(-maxEntries);
}

export function getMostRecentDeliverableArtifact(
  registry: DeliverableChannelArtifact[]
): DeliverableChannelArtifact | null {
  return registry.at(-1) ?? null;
}

export async function mintDeliverableArtifacts(input: {
  artifacts: ChannelArtifactRef[];
  shareUrlCache: Record<string, string>;
  publish: (relativePath: string) => Promise<PublishArtifactShareResult>;
}): Promise<DeliverableChannelArtifact[]> {
  const delivered: DeliverableChannelArtifact[] = [];

  for (const artifact of input.artifacts) {
    try {
      const response = await input.publish(artifact.path);
      const resolved = resolveShareUrlForPublish(
        response,
        input.shareUrlCache,
        artifact.path
      );

      delivered.push({
        ...artifact,
        sharePath: resolved.sharePath,
        shareUrl: resolved.shareUrl,
      });
    } catch {
      // Skip failed publishes; text reply still goes out.
    }
  }

  return delivered;
}
