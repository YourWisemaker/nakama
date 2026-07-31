import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ToolContext } from "../contract";

const REFERENCE_TTL_MS = 10 * 60 * 1000;
const referenceSecret = Buffer.from(
  process.env.NAKAMA_EMAIL_ATTACHMENT_SECRET ?? randomBytes(32).toString("base64url"),
  "utf8",
);

interface AttachmentReferenceClaims {
  orgId: string;
  profileId: string;
  sessionId: string;
  folder: string;
  uid: number;
  attachmentId: string;
  expiresAt: number;
}

function contextScope(context: ToolContext): Pick<
  AttachmentReferenceClaims,
  "orgId" | "profileId" | "sessionId"
> {
  const sessionId = context.sessionId ?? context.automationRunId;
  if (!context.orgId || !context.profileId || !sessionId) {
    throw new Error("Email attachment references require an organization, profile, and session.");
  }

  return {
    orgId: context.orgId,
    profileId: context.profileId,
    sessionId,
  };
}

function sign(payload: string): string {
  return createHmac("sha256", referenceSecret).update(payload).digest("base64url");
}

export function createAttachmentReference(
  context: ToolContext,
  input: { folder: string; uid: number; attachmentId: string },
): string {
  const claims: AttachmentReferenceClaims = {
    ...contextScope(context),
    ...input,
    expiresAt: Date.now() + REFERENCE_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAttachmentReference(
  context: ToolContext,
  reference: string,
): Omit<AttachmentReferenceClaims, "orgId" | "profileId" | "sessionId"> {
  const [payload, signature] = reference.split(".");
  if (!payload || !signature) {
    throw new Error("Invalid email attachment reference.");
  }

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid email attachment reference.");
  }

  let claims: AttachmentReferenceClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AttachmentReferenceClaims;
  } catch {
    throw new Error("Invalid email attachment reference.");
  }

  const scope = contextScope(context);
  if (
    claims.orgId !== scope.orgId ||
    claims.profileId !== scope.profileId ||
    claims.sessionId !== scope.sessionId ||
    !Number.isInteger(claims.uid) ||
    claims.expiresAt <= Date.now()
  ) {
    throw new Error("Email attachment reference expired or out of scope.");
  }

  return {
    folder: claims.folder,
    uid: claims.uid,
    attachmentId: claims.attachmentId,
    expiresAt: claims.expiresAt,
  };
}
