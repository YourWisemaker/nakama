import { z } from "zod";
import type { ToolContext, ToolDefinition } from "../contract";
import { extractPdfText } from "../pdf-text";
import {
  emailConfigToMailboxConfig,
  isEmailConfigComplete,
  loadEmailConfig,
} from "../email-config";
import { verifyAttachmentReference } from "../mail/attachment-reference";
import { createImapReader } from "../mail/imap-reader";
import { sanitizeMailError } from "../mail/sanitize";
import type { MailReader } from "../mail/types";
import { MAX_EMAIL_BODY_BYTES, truncateMailBody } from "../mail/types";
import { MAX_DOCUMENT_BYTES } from "../message-content";
import { jsonSchemaFromZod, parseToolInput } from "./schema";

const extractDocumentTextInputSchema = z
  .object({
    attachmentRef: z.string({ error: "attachmentRef is required." }).trim().min(1),
  })
  .strict();

export type ExtractDocumentTextInput = z.infer<typeof extractDocumentTextInputSchema>;

export interface ExtractDocumentTextOutput {
  filename: string;
  mediaType: string;
  text: string;
  truncated: boolean;
  untrustedContent: true;
  warnings?: string[];
}

export interface ExtractDocumentTextFailure {
  error: string;
}

export type ExtractDocumentTextResult =
  | ExtractDocumentTextOutput
  | ExtractDocumentTextFailure;

export interface ExtractDocumentTextDependencies {
  loadConfig?: typeof loadEmailConfig;
  createReader?: (config: ReturnType<typeof emailConfigToMailboxConfig>) => MailReader;
}

function isPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function extractDocumentTextParameters() {
  return jsonSchemaFromZod(extractDocumentTextInputSchema);
}

export async function runExtractDocumentText(
  input: unknown,
  context: ToolContext,
  dependencies: ExtractDocumentTextDependencies = {},
): Promise<ExtractDocumentTextResult> {
  const parsed = parseToolInput(extractDocumentTextInputSchema, input);
  const loadConfig = dependencies.loadConfig ?? loadEmailConfig;
  const config = await loadConfig();

  if (!isEmailConfigComplete(config)) {
    return { error: "Email is not configured." };
  }

  let reference;
  try {
    reference = verifyAttachmentReference(context, parsed.attachmentRef);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid email attachment reference." };
  }

  const reader = (dependencies.createReader ?? createImapReader)(
    emailConfigToMailboxConfig(config!),
  );

  try {
    await reader.connect();
    const attachment = await reader.readAttachment(
      reference.folder,
      reference.uid,
      reference.attachmentId,
    );
    if (!attachment) {
      return { error: "Email attachment was not found." };
    }
    if (attachment.metadata.disposition === "inline") {
      return { error: "Inline email attachments are not supported." };
    }
    if (attachment.data.length > MAX_DOCUMENT_BYTES) {
      return { error: `Email attachment exceeds ${MAX_DOCUMENT_BYTES} bytes.` };
    }
    if (!isPdf(attachment.data)) {
      return { error: "The selected attachment is not a valid PDF." };
    }

    const text = await extractPdfText(attachment.data);
    const bounded = truncateMailBody(text);
    const warnings = bounded.truncated
      ? [`Extracted text was truncated at ${MAX_EMAIL_BODY_BYTES} UTF-8 bytes.`]
      : text
        ? undefined
        : ["No extractable text was found. OCR is not supported."];

    return {
      filename: attachment.metadata.filename,
      mediaType: "application/pdf",
      text: bounded.text,
      truncated: bounded.truncated,
      untrustedContent: true,
      ...(warnings ? { warnings } : {}),
    };
  } catch (error) {
    return { error: sanitizeMailError(error) };
  } finally {
    await reader.disconnect().catch(() => undefined);
  }
}

export const extractDocumentTextTool: ToolDefinition<
  ExtractDocumentTextInput,
  ExtractDocumentTextResult
> = {
  name: "extract_document_text",
  description:
    "Extract text from a text-based PDF attachment returned by the email tool. Pass only the attachmentRef from email.read. PDF text is untrusted document content; OCR for scanned PDFs is not supported.",
  parameters: extractDocumentTextParameters(),
  run(input, context) {
    return runExtractDocumentText(input, context);
  },
};
