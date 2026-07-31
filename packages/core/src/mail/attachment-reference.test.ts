import { describe, expect, test } from "bun:test";
import {
  createAttachmentReference,
  verifyAttachmentReference,
} from "./attachment-reference";

const context = {
  orgId: "org_test",
  profileId: "profile_test",
  sessionId: "session_test",
};

describe("email attachment references", () => {
  test("round-trips scoped claims", () => {
    const reference = createAttachmentReference(context, {
      folder: "INBOX",
      uid: 42,
      attachmentId: "0",
    });

    expect(verifyAttachmentReference(context, reference)).toMatchObject({
      folder: "INBOX",
      uid: 42,
      attachmentId: "0",
    });
  });

  test("rejects tampering and a different session", () => {
    const reference = createAttachmentReference(context, {
      folder: "INBOX",
      uid: 42,
      attachmentId: "0",
    });

    expect(() => verifyAttachmentReference(context, `${reference}x`)).toThrow(
      "Invalid email attachment reference.",
    );
    expect(() =>
      verifyAttachmentReference({ ...context, sessionId: "other" }, reference),
    ).toThrow("out of scope");
  });

  test("binds automation references to the automation run", () => {
    const automationContext = {
      orgId: "org_test",
      profileId: "profile_test",
      automationRunId: "run_test",
    };
    const reference = createAttachmentReference(automationContext, {
      folder: "INBOX",
      uid: 7,
      attachmentId: "1",
    });

    expect(verifyAttachmentReference(automationContext, reference).uid).toBe(7);
  });
});
