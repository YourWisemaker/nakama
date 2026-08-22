import { getImageBinary, hasImage } from "@crosscopy/clipboard";
import { type ImageAttachment, validateImageAttachments } from "@nakama/core";

export async function readClipboardImage(): Promise<ImageAttachment | null> {
  if (!hasImage()) {
    return null;
  }

  const bytes = await getImageBinary();

  if (!bytes?.length) {
    return null;
  }

  const attachment: ImageAttachment = {
    data: Buffer.from(bytes).toString("base64"),
    mediaType: "image/png",
  };

  validateImageAttachments([attachment]);
  return attachment;
}
