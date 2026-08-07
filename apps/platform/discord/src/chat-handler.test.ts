import path from "node:path";
import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "@nakama/core/contract";
import { DiscordAuthStore } from "./auth-store";
import { createChatHandler } from "./chat-handler";
import { SessionStore } from "./session-store";
import { ThreadStore } from "./thread-store";
import {
  createDmMessage,
  createGuildChatMessage,
  createMockClient,
  createMultiTestOrgs,
  createSlashInteraction,
  createTestOrgStore,
  withTempHome,
  writeDiscordConfigIni,
} from "./test-helpers";

async function createPairedHandler(
  homeDir: string,
  options: {
    messages?: ChatMessage[];
    onSendStream?: Parameters<typeof createMockClient>[0]["onSendStream"];
    questionnaire?: Parameters<typeof createMockClient>[0]["questionnaire"];
    orgs?: Parameters<typeof createMockClient>[0]["orgs"];
  } = {},
) {
  await writeDiscordConfigIni(homeDir, {
    botToken: "discord-bot-token",
    pairedUserIds: ["424242424242424242"],
  });

  const authStore = new DiscordAuthStore();
  await authStore.reload();
  const { client, calls } = createMockClient(options);
  const sessionStore = new SessionStore(
    path.join(homeDir, ".nakama", "discord", "chat-sessions.json"),
  );
  await sessionStore.load();
  const threadStore = new ThreadStore(
    path.join(homeDir, ".nakama", "discord", "chat-threads.json"),
  );
  await threadStore.load();
  const orgStore = createTestOrgStore(homeDir);
  await orgStore.load();
  const handlers = createChatHandler({
    client,
    config: { botToken: "discord-bot-token", profileId: "default" },
    authStore,
    sessionStore,
    threadStore,
    orgStore,
  });

  return { ...handlers, client, calls, sessionStore, threadStore, orgStore };
}

describe("createChatHandler artifact delivery", () => {
  const metaJson = JSON.stringify({
    mimeType: "text/markdown",
    savedAt: "2026-07-13T10:00:00.000Z",
    sizeBytes: 42,
  });

  const artifactMessages: ChatMessage[] = [
    { role: "user", content: "save report" },
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "tool_1",
          name: "write_file",
          arguments: { path: "artifacts/report.md", content: "# Report" },
        },
        {
          id: "tool_2",
          name: "write_file",
          arguments: { path: "artifacts/report.md.nakama-meta.json", content: metaJson },
        },
      ],
    },
    {
      role: "tool",
      toolCallId: "tool_1",
      name: "write_file",
      content: JSON.stringify({
        path: "/home/.nakama/orgs/org/profiles/default/artifacts/report.md",
        bytesWritten: 8,
      }),
    },
    {
      role: "tool",
      toolCallId: "tool_2",
      name: "write_file",
      content: JSON.stringify({
        path: "/home/.nakama/orgs/org/profiles/default/artifacts/report.md.nakama-meta.json",
        bytesWritten: metaJson.length,
      }),
    },
    { role: "assistant", content: "Saved the report." },
  ];

  test("auto-uploads a small artifact after a paired save-artifact turn", async () => {
    await withTempHome(async (homeDir) => {
      const { handleMessage, calls, sessionStore } = await createPairedHandler(homeDir, {
        messages: artifactMessages,
      });
      sessionStore.set("dm_channel_1", {
        sessionId: "session_test",
        profileId: "default",
        updatedAt: new Date().toISOString(),
      });
      await sessionStore.save();

      const dm = createDmMessage({
        userId: "424242424242424242",
        content: "thanks",
      });
      await handleMessage(dm.message);

      expect(calls.publishProfileArtifactShare).toBe(1);
      expect(calls.readProfileArtifactContent).toBe(1);
      expect(dm.fileSendCalls).toBe(1);
      expect(dm.sentMessages.some((reply) => reply.includes("https://app.example/s/tok_test"))).toBe(
        false,
      );
    });
  });

  test("falls back to a share link when the artifact exceeds the Discord attachment cap", async () => {
    await withTempHome(async (homeDir) => {
      const oversizedMeta = JSON.stringify({
        mimeType: "video/mp4",
        savedAt: "2026-07-13T10:00:00.000Z",
        sizeBytes: 9 * 1024 * 1024,
      });
      const oversizedMessages: ChatMessage[] = [
        { role: "user", content: "save video" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool_1",
              name: "write_file",
              arguments: { path: "artifacts/clip.mp4", content: "binary" },
            },
            {
              id: "tool_2",
              name: "write_file",
              arguments: { path: "artifacts/clip.mp4.nakama-meta.json", content: oversizedMeta },
            },
          ],
        },
        {
          role: "tool",
          toolCallId: "tool_1",
          name: "write_file",
          content: JSON.stringify({
            path: "/home/.nakama/orgs/org/profiles/default/artifacts/clip.mp4",
            bytesWritten: 9 * 1024 * 1024,
          }),
        },
        {
          role: "tool",
          toolCallId: "tool_2",
          name: "write_file",
          content: JSON.stringify({
            path: "/home/.nakama/orgs/org/profiles/default/artifacts/clip.mp4.nakama-meta.json",
            bytesWritten: oversizedMeta.length,
          }),
        },
        { role: "assistant", content: "Saved the clip." },
      ];

      const { handleMessage, calls, sessionStore } = await createPairedHandler(homeDir, {
        messages: oversizedMessages,
      });
      sessionStore.set("dm_channel_1", {
        sessionId: "session_test",
        profileId: "default",
        updatedAt: new Date().toISOString(),
      });
      await sessionStore.save();

      const dm = createDmMessage({
        userId: "424242424242424242",
        content: "thanks",
      });
      await handleMessage(dm.message);

      expect(calls.publishProfileArtifactShare).toBe(1);
      expect(calls.readProfileArtifactContent).toBe(0);
      expect(dm.fileSendCalls).toBe(0);
      expect(dm.sentMessages.some((reply) => reply.includes("https://app.example/s/tok_test"))).toBe(
        true,
      );
    });
  });

  test("does not publish when the turn has no sidecar pair", async () => {
    await withTempHome(async (homeDir) => {
      const { handleMessage, calls, sessionStore } = await createPairedHandler(homeDir, {
        messages: [
          { role: "user", content: "save" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool_1",
                name: "write_file",
                arguments: { path: "artifacts/draft.md", content: "draft" },
              },
            ],
          },
          {
            role: "tool",
            toolCallId: "tool_1",
            name: "write_file",
            content: JSON.stringify({
              path: "/home/.nakama/orgs/org/profiles/default/artifacts/draft.md",
              bytesWritten: 5,
            }),
          },
        ],
      });
      sessionStore.set("dm_channel_1", {
        sessionId: "session_test",
        profileId: "default",
        updatedAt: new Date().toISOString(),
      });
      await sessionStore.save();

      const { message, sentMessages } = createDmMessage({
        userId: "424242424242424242",
        content: "thanks",
      });
      await handleMessage(message);

      expect(calls.publishProfileArtifactShare).toBe(0);
      expect(sentMessages.some((reply) => reply.includes("/s/"))).toBe(false);
    });
  });

  test("sends a document when the user asks to attach a saved artifact", async () => {
    await withTempHome(async (homeDir) => {
      const { handleMessage, calls, sessionStore } = await createPairedHandler(homeDir);
      sessionStore.set("dm_channel_1", {
        sessionId: "session_test",
        profileId: "default",
        updatedAt: new Date().toISOString(),
        deliverableArtifacts: [
          {
            filename: "report.md",
            path: "report.md",
            mimeType: "text/markdown",
            sizeBytes: 42,
            savedAt: "2026-07-13T10:00:00.000Z",
            shareUrl: "https://app.example/s/tok_test",
            sharePath: "/s/tok_test",
          },
        ],
      });
      await sessionStore.save();

      const dm = createDmMessage({
        userId: "424242424242424242",
        content: "send me the file",
      });
      await handleMessage(dm.message);

      expect(calls.readProfileArtifactContent).toBe(1);
      expect(dm.fileSendCalls).toBe(1);
    });
  });
});

describe("createChatHandler questionnaire delivery", () => {
  const questionnaire = {
    id: "qset_1",
    title: "Need input",
    questions: [
      {
        id: "how-to-run",
        prompt: "How should I run this?",
        choices: [
          { id: "playwright", label: "Build Playwright e2e" },
          { id: "manual", label: "Manual steps only" },
        ],
        allowCustomAnswer: true,
      },
    ],
  };

  test("posts the questionnaire when ask_user_question fires and skips empty reply", async () => {
    await withTempHome(async (homeDir) => {
      const { handleMessage } = await createPairedHandler(homeDir, {
        onSendStream: async (_input, handlers) => {
          handlers?.onQuestionnaireUpdated?.(questionnaire);
          return "";
        },
      });
      const { message, sentMessages } = createDmMessage({
        userId: "424242424242424242",
        content: "help me ship this",
      });
      await handleMessage(message);

      expect(sentMessages.some((reply) => reply.includes("Need input"))).toBe(true);
      expect(sentMessages.some((reply) => reply.includes("a) Build Playwright e2e"))).toBe(true);
      expect(sentMessages.some((reply) => reply.includes("(empty reply)"))).toBe(false);
    });
  });

  test("maps the next Discord reply into Answers for the pending questionnaire", async () => {
    await withTempHome(async (homeDir) => {
      const streamedInputs: unknown[] = [];
      const { handleMessage, sessionStore } = await createPairedHandler(homeDir, {
        questionnaire,
        onSendStream: async (input) => {
          streamedInputs.push(input);
          return "Got it.";
        },
      });
      sessionStore.set("dm_channel_1", {
        sessionId: "session_test",
        profileId: "default",
        updatedAt: new Date().toISOString(),
      });
      await sessionStore.save();

      const { message, sentMessages } = createDmMessage({
        userId: "424242424242424242",
        content: "a",
      });
      await handleMessage(message);

      expect(streamedInputs[0]).toEqual({
        message: [
          "Answers",
          "",
          "Q: How should I run this?",
          "A: Build Playwright e2e",
        ].join("\n"),
      });
      expect(sentMessages).toContain("Got it.");
    });
  });
});

describe("createChatHandler guild thread routing", () => {
  test("mention in a guild channel creates a thread and replies inside it", async () => {
    await withTempHome(async (homeDir) => {
      const streamedInputs: unknown[] = [];
      const { handleMessage, threadStore } = await createPairedHandler(homeDir, {
        onSendStream: async (input) => {
          streamedInputs.push(input);
          return "Thread reply";
        },
      });

      const guild = createGuildChatMessage({
        content: "<@bot_id> summarize this",
        mentionsBot: true,
      });
      await handleMessage(guild.message);

      expect(guild.startThreadCalls).toBe(1);
      expect(guild.lastThreadName).toBe("summarize this");
      expect(guild.threadSentMessages).toContain("Thread reply");
      expect(guild.channelSentMessages).not.toContain("Thread reply");
      expect(threadStore.get("g:guild_channel_1:u:424242424242424242")).toBe(
        guild.createdThreadId,
      );
      expect(streamedInputs[0]).toEqual({ message: "summarize this" });
    });
  });

  test("second mention in the same channel reuses the existing thread", async () => {
    await withTempHome(async (homeDir) => {
      const { handleMessage, threadStore } = await createPairedHandler(homeDir, {
        onSendStream: async () => "Again",
      });

      const first = createGuildChatMessage({
        content: "<@bot_id> first question",
        mentionsBot: true,
      });
      await handleMessage(first.message);
      const threadId = first.createdThreadId;
      expect(threadId).toBeTruthy();
      expect(threadStore.get("g:guild_channel_1:u:424242424242424242")).toBe(threadId);

      const existingThreads = new Map([
        [threadId!, { id: threadId!, parentId: "guild_channel_1", archived: false }],
      ]);

      const second = createGuildChatMessage({
        content: "<@bot_id> follow up",
        mentionsBot: true,
        existingThreads,
      });
      await handleMessage(second.message);

      expect(second.startThreadCalls).toBe(0);
      expect(second.threadSentMessages).toContain("Again");
      expect(second.channelSentMessages).not.toContain("Again");
    });
  });

  test("thread message without mention is answered in the thread", async () => {
    await withTempHome(async (homeDir) => {
      const streamedInputs: unknown[] = [];
      const { handleMessage } = await createPairedHandler(homeDir, {
        onSendStream: async (input) => {
          streamedInputs.push(input);
          return "In-thread answer";
        },
      });

      const guild = createGuildChatMessage({
        content: "keep going",
        inThread: true,
        threadId: "thread_42",
        parentId: "guild_channel_1",
      });
      await handleMessage(guild.message);

      expect(guild.startThreadCalls).toBe(0);
      expect(guild.threadSentMessages).toContain("In-thread answer");
      expect(streamedInputs[0]).toEqual({ message: "keep going" });
    });
  });

  test("thread messages reuse the parent channel org selection", async () => {
    await withTempHome(async (homeDir) => {
      const streamedInputs: unknown[] = [];
      const { handleMessage, orgStore } = await createPairedHandler(homeDir, {
        orgs: createMultiTestOrgs(),
        onSendStream: async (input) => {
          streamedInputs.push(input);
          return "In-thread answer";
        },
      });

      orgStore.set("g:guild_channel_1", "org_a");
      await orgStore.save();

      const guild = createGuildChatMessage({
        content: "keep going",
        inThread: true,
        threadId: "thread_42",
        parentId: "guild_channel_1",
      });
      await handleMessage(guild.message);

      expect(guild.threadSentMessages.some((text) => text.includes("Choose an organization"))).toBe(
        false,
      );
      expect(guild.threadSentMessages).toContain("In-thread answer");
      expect(streamedInputs).toHaveLength(1);
      expect(orgStore.get("g:thread_42")).toBeUndefined();
      expect(orgStore.get("g:guild_channel_1")?.orgId).toBe("org_a");
    });
  });

  test("slash commands in threads reuse the parent channel org selection", async () => {
    await withTempHome(async (homeDir) => {
      const { handleSlashCommand, orgStore } = await createPairedHandler(homeDir, {
        orgs: createMultiTestOrgs(),
      });

      orgStore.set("g:guild_channel_1", "org_b");
      await orgStore.save();

      const clearCmd = createSlashInteraction({
        commandName: "clear",
        inThread: true,
        threadId: "thread_1",
        parentId: "guild_channel_1",
      });
      await handleSlashCommand(clearCmd.interaction);

      expect(clearCmd.replies.some((text) => text.includes("Choose an organization"))).toBe(false);
      expect(clearCmd.replies).toContain("History cleared.");
      expect(orgStore.get("g:thread_1")).toBeUndefined();
    });
  });

  test("thread creation failure falls back to channel reply", async () => {
    await withTempHome(async (homeDir) => {
      const { handleMessage } = await createPairedHandler(homeDir, {
        onSendStream: async (input) => {
          // Fallback path still uses the public-channel prefix.
          expect(input).toEqual({
            message:
              "[Discord channel — your reply is visible to everyone in this channel.]\nhello",
          });
          return "Channel fallback";
        },
      });

      const guild = createGuildChatMessage({
        content: "<@bot_id> hello",
        mentionsBot: true,
        startThreadError: new Error("Missing Permissions"),
      });
      await handleMessage(guild.message);

      expect(guild.startThreadCalls).toBe(1);
      expect(guild.channelSentMessages).toContain("Channel fallback");
      expect(guild.threadSentMessages).toHaveLength(0);
    });
  });

  test("slash commands in threads still clear and start new sessions", async () => {
    await withTempHome(async (homeDir) => {
      const { handleSlashCommand, sessionStore } = await createPairedHandler(homeDir);
      const conversationKey = "g:guild_channel_1:t:thread_1";
      sessionStore.set(conversationKey, {
        sessionId: "session_test",
        profileId: "default",
        updatedAt: new Date().toISOString(),
      });
      await sessionStore.save();

      const clearCmd = createSlashInteraction({
        commandName: "clear",
        inThread: true,
        threadId: "thread_1",
        parentId: "guild_channel_1",
      });
      await handleSlashCommand(clearCmd.interaction);
      expect(clearCmd.replies).toContain("History cleared.");

      const newCmd = createSlashInteraction({
        commandName: "new",
        inThread: true,
        threadId: "thread_1",
        parentId: "guild_channel_1",
      });
      await handleSlashCommand(newCmd.interaction);
      expect(newCmd.replies).toContain("Started a new conversation.");

      const stopCmd = createSlashInteraction({
        commandName: "stop",
        inThread: true,
        threadId: "thread_1",
        parentId: "guild_channel_1",
      });
      await handleSlashCommand(stopCmd.interaction);
      expect(stopCmd.replies).toContain("Nothing to stop.");
    });
  });
});
