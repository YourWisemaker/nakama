import { getImageBinary, hasImage } from "@crosscopy/clipboard";
import {
  type ImageAttachment,
  MAX_IMAGE_BYTES,
  validateImageAttachments,
} from "@nakama/core";

export function detectClipboardImageMediaType(
  bytes: Uint8Array | Buffer
): ImageAttachment["mediaType"] {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39)
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  throw new Error(
    "Unsupported clipboard image type. Allowed: jpeg, png, gif, webp."
  );
}

export function attachmentFromClipboardBytes(
  bytes: Uint8Array | Buffer
): ImageAttachment {
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Clipboard image is too large (${bytes.length} bytes). Maximum is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`
    );
  }

  return {
    data: Buffer.from(bytes).toString("base64"),
    mediaType: detectClipboardImageMediaType(bytes),
  };
}

export async function readClipboardImage(): Promise<ImageAttachment | null> {
  if (!hasImage()) {
    return null;
  }

  const bytes = await getImageBinary();

  if (!bytes?.length) {
    return null;
  }

  const attachment = attachmentFromClipboardBytes(bytes);
  validateImageAttachments([attachment]);
  return attachment;
}
