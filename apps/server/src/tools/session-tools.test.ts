import { describe, expect, test } from "bun:test";
import type { ToolContext } from "@nakama/core";
import type { DatabaseAdapter, StoredProfileRecord } from "@nakama/db";
import {
  createInMemoryDatabaseAdapter,
  createSqliteDatabase,
} from "@nakama/db";
import { AgentService } from "../services/agent-service";
import { createSessionTools } from "./session-tools";

const ORG_A = "org_a";
const ORG_B = "org_b";

function profile(id: string, orgId: string): StoredProfileRecord {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    id,
    isDefault: false,
    isSuper: false,
    model: null,
    name: id,
    orgId,
    systemPrompt: "You are helpful.",
    updatedAt: now,
  };
}

function context(orgId?: string): ToolContext {
  return { orgId };
}

async function seedSession(
  db: DatabaseAdapter,
  service: AgentService,
  options: { channel: "web" | "cli"; orgId: string; profileId: string }
): Promise<string> {
  const sessionId = await service.createSession(
    options.orgId,
    options.channel,
    options.profileId
  );

  await db.replaceMessagesForSession(
    sessionId,
    ["first", "second", "third"].map((text, index) => ({
      createdAt: `2026-08-21T10:00:0${index}.000Z`,
      id: `${sessionId}_msg_${index}`,
      payload: { content: text, role: index % 2 === 0 ? "user" : "assistant" },
      seq: index,
      sessionId,
    }))
  );

  return sessionId;
}

async function setUp(db: DatabaseAdapter) {
  // Real SQLite enforces the profiles -> organizations foreign key, so the org
  // rows have to exist first. The in-memory adapter does not care either way.
  const now = new Date().toISOString();
  for (const orgId of [ORG_A, ORG_B]) {
    await db.upsertOrganization({
      createdAt: now,
      id: orgId,
      name: orgId,
      slug: orgId.replace("_", "-"),
      updatedAt: now,
    });
  }

  await db.upsertProfile(profile("profile_reader", ORG_A));
  await db.upsertProfile(profile("profile_target", ORG_A));
  await db.upsertProfile(profile("profile_other_org", ORG_B));

  const service = new AgentService(null, null, db);
  const [listTool, readTool] = createSessionTools(service);
  const webSessionId = await seedSession(db, service, {
    channel: "web",
    orgId: ORG_A,
    profileId: "profile_target",
  });
  const cliSessionId = await seedSession(db, service, {
    channel: "cli",
    orgId: ORG_A,
    profileId: "profile_target",
  });
  const foreignSessionId = await seedSession(db, service, {
    channel: "web",
    orgId: ORG_B,
    profileId: "profile_other_org",
  });

  return { cliSessionId, foreignSessionId, listTool, readTool, webSessionId };
}

describe("session reader tools", () => {
  test("lists another profile's sessions in the same org", async () => {
    const { listTool, webSessionId } = await setUp(
      createInMemoryDatabaseAdapter()
    );

    const result = (await listTool.run(
      { profileId: "profile_target" },
      context(ORG_A)
    )) as { sessions: Array<{ id: string; profileId: string }> };

    expect(result.sessions.map((session) => session.id)).toEqual([
      webSessionId,
    ]);
    expect(result.sessions[0]?.profileId).toBe("profile_target");
  });

  test("defaults to the web channel and returns cli sessions on request", async () => {
    const { cliSessionId, listTool } = await setUp(
      createInMemoryDatabaseAdapter()
    );

    const cli = (await listTool.run(
      { channel: "cli", profileId: "profile_target" },
      context(ORG_A)
    )) as { sessions: Array<{ id: string }> };

    expect(cli.sessions.map((session) => session.id)).toEqual([cliSessionId]);
  });

  test("rejects an unknown channel rather than silently listing web", async () => {
    const { listTool } = await setUp(createInMemoryDatabaseAdapter());

    await expect(
      listTool.run(
        { channel: "carrier-pigeon", profileId: "profile_target" },
        context(ORG_A)
      )
    ).rejects.toThrow("Unknown channel: carrier-pigeon.");
  });

  test("reads the persisted transcript of another profile's session", async () => {
    const { readTool, webSessionId } = await setUp(
      createInMemoryDatabaseAdapter()
    );

    const result = (await readTool.run(
      { sessionId: webSessionId },
      context(ORG_A)
    )) as {
      channel: string;
      messages: Array<{ content: string }>;
      profileId: string;
      returnedMessages: number;
      totalMessages: number;
    };

    expect(result.channel).toBe("web");
    expect(result.profileId).toBe("profile_target");
    expect(result.totalMessages).toBe(3);
    expect(result.returnedMessages).toBe(3);
    expect(result.messages.map((message) => message.content)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  test("pages the transcript with limit and offset", async () => {
    const { readTool, webSessionId } = await setUp(
      createInMemoryDatabaseAdapter()
    );

    const result = (await readTool.run(
      { limit: 1, offset: 1, sessionId: webSessionId },
      context(ORG_A)
    )) as {
      messages: Array<{ content: string }>;
      returnedMessages: number;
      totalMessages: number;
    };

    expect(result.totalMessages).toBe(3);
    expect(result.returnedMessages).toBe(1);
    expect(result.messages.map((message) => message.content)).toEqual([
      "second",
    ]);
  });

  test("refuses a profile in another org with the same error as an unknown one", async () => {
    const { listTool } = await setUp(createInMemoryDatabaseAdapter());

    await expect(
      listTool.run({ profileId: "profile_other_org" }, context(ORG_A))
    ).rejects.toThrow("Profile not found.");
    await expect(
      listTool.run({ profileId: "profile_does_not_exist" }, context(ORG_A))
    ).rejects.toThrow("Profile not found.");
  });

  test("refuses a session in another org", async () => {
    const { foreignSessionId, readTool } = await setUp(
      createInMemoryDatabaseAdapter()
    );

    await expect(
      readTool.run({ sessionId: foreignSessionId }, context(ORG_A))
    ).rejects.toThrow("Session not found.");
  });

  test("refuses a session in another org on real SQLite too", async () => {
    // sessions has no org_id column, so the in-memory adapter can keep an orgId
    // the SQL adapter drops. This runs the same case against the real schema.
    const database = await createSqliteDatabase(":memory:");
    const { foreignSessionId, readTool, webSessionId } = await setUp(
      database.adapter
    );

    await expect(
      readTool.run({ sessionId: foreignSessionId }, context(ORG_A))
    ).rejects.toThrow("Session not found.");

    const allowed = (await readTool.run(
      { sessionId: webSessionId },
      context(ORG_A)
    )) as { totalMessages: number };

    expect(allowed.totalMessages).toBe(3);
  });

  test("requires an organization context", async () => {
    const { listTool, readTool } = await setUp(createInMemoryDatabaseAdapter());

    await expect(
      listTool.run({ profileId: "profile_target" }, context(undefined))
    ).rejects.toThrow("Organization context is required.");
    await expect(
      readTool.run({ sessionId: "session_x" }, context(undefined))
    ).rejects.toThrow("Organization context is required.");
  });
});
