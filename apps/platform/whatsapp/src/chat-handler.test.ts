import { beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { resetActiveStreamsForTests } from "./active-stream";
import { WhatsAppAuthStore } from "./auth-store";
import { createChatHandler, resetChatLocksForTests } from "./chat-handler";
import { SessionStore } from "./session-store";
import {
  createMockClient,
  createMultiTestOrgs,
  createTestOrgStore,
  waitForStreamControl,
  withTempHome,
  writeWhatsAppConfigIni,
} from "./test-helpers";

const PAIRED_JID = "1234567890@s.whatsapp.net";

function createMockSocket() {
  const sent: Array<{ jid: string; text: string }> = [];

  const socket = {
    end: () => {},
    ev: {
      off: () => {},
      on: () => {},
    },
    sendMessage: async (jid: string, content: { text: string }) => {
      sent.push({ jid, text: content.text });
    },
    sendPresenceUpdate: async () => {},
  };

  return { sent, socket };
}

beforeEach(() => {
  resetActiveStreamsForTests();
  resetChatLocksForTests();
});

describe("createChatHandler", () => {
  test("blocks unauthorized JID from chatting", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairingCode: "ABCD1234",
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        profiles: [
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "default",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Default",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "profile_tensetutor",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Tense Tutor",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: "9999999999@s.whatsapp.net", text: "hello" });

      expect(sent.length).toBeGreaterThanOrEqual(1);
      expect(calls.createSession).toBe(0);
      expect(calls.sendStream).toBe(0);
    });
  });

  test("rejects invalid pairing codes", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairingCode: "ABCD1234",
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        profiles: [
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "default",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Default",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "profile_tensetutor",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Tense Tutor",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: "9999999999@s.whatsapp.net", text: "WRONG" });

      expect(sent.length).toBe(1);
      expect(sent[0].text).toContain("Invalid pairing code");
      expect(calls.sendStream).toBe(0);
    });
  });

  test("pairs a JID with a valid code and allows chatting", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairingCode: "ABCD1234",
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        profiles: [
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "default",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Default",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "profile_tensetutor",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Tense Tutor",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      const pairJid = "1234567890@s.whatsapp.net";
      await handleMessage({ jid: pairJid, text: "ABCD1234" });

      expect(sent.length).toBe(1);
      expect(sent[0].text).toContain("Linked successfully");
      expect(authStore.isAuthorized(pairJid)).toBe(true);

      await handleMessage({ jid: pairJid, text: "hello agent" });
      expect(calls.createSession).toBe(1);
      expect(calls.sendStream).toBe(1);
    });
  });

  test("allows pre-paired JID to chat directly", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        profiles: [
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "default",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Default",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "profile_tensetutor",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Tense Tutor",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "hello agent" });

      expect(calls.createSession).toBe(1);
      expect(calls.sendStream).toBe(1);
    });
  });

  test("allows device-suffixed inbound JID for a paired phone JID", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: "6281379292556@s.whatsapp.net",
        phoneNumber: "6281379292556",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        profiles: [
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "default",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Default",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "profile_tensetutor",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Tense Tutor",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "6281379292556", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({
        jid: "6281379292556:12@s.whatsapp.net",
        text: "hello agent",
      });

      expect(calls.createSession).toBe(1);
      expect(calls.sendStream).toBe(1);
    });
  });

  test("handles /help command for authorized JID", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "/help" });

      expect(sent.length).toBe(1);
      expect(sent[0].text).toContain("/help");
      expect(calls.sendStream).toBe(0);
    });
  });

  test("handles /clear command", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "/clear" });

      expect(calls.compact).toBe(0);
      expect(sent.length).toBe(1);
      expect(sent[0].text).toBe("History cleared.");
    });
  });

  test("handles /compact command", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "/compact" });

      expect(calls.compact).toBe(1);
      expect(sent.length).toBe(1);
      expect(sent[0].text).toContain("Compacted");
    });
  });

  test("/stop aborts an in-flight stream without waiting for the chat lock", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls, getStreamControl } = createMockClient({
        streaming: true,
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      const chatPromise = handleMessage({
        jid: PAIRED_JID,
        text: "hello agent",
      });

      await waitForStreamControl(getStreamControl);

      await handleMessage({ jid: PAIRED_JID, text: "/stop" });

      await chatPromise;

      expect(calls.sendStream).toBe(1);
      expect(sent.map((message) => message.text)).toEqual(["Stopped."]);
    });
  });

  test("/stop with no active stream replies nothing to stop", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "/stop" });

      expect(sent.length).toBe(1);
      expect(sent[0].text).toBe("Nothing to stop.");
    });
  });

  test("unknown commands return help text", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "/unknown" });

      expect(sent.length).toBe(1);
      expect(sent[0].text).toContain("Unknown command");
      expect(calls.sendStream).toBe(0);
    });
  });

  test("falls back to an existing profile when config points to a missing one", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
        profileId: "missing_profile",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        profiles: [
          {
            createdAt: new Date().toISOString(),
            hasAvatar: false,
            id: "profile_tensetutor",
            isSuper: false,
            mcpServerCount: 0,
            model: null,
            name: "Tense Tutor",
            soulActive: false,
            toolCount: 0,
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();

      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "/new" });

      expect(calls.listProfiles).toBe(1);
      expect(calls.profileIds).toEqual(["profile_tensetutor"]);
      expect(sent[0]?.text).toContain("Started a new conversation.");
    });
  });
});

describe("bridge API integration", () => {
  test("calls org and profile APIs before creating a chat session", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls, orgIds } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "hello" });

      expect(calls.listUserOrgs).toBeGreaterThanOrEqual(1);
      expect(calls.setOrgId).toBeGreaterThanOrEqual(1);
      expect(orgIds).toContain("org_test");
      expect(calls.listProfiles).toBeGreaterThanOrEqual(1);
      expect(calls.createSession).toBe(1);
      expect(calls.sendStream).toBe(1);
    });
  });

  test("auto-selects a single org without prompting", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "hello" });

      expect(
        sent.some((message) => message.text.includes("Choose an organization"))
      ).toBe(false);
      expect(orgStore.get(PAIRED_JID)?.orgId).toBe("org_test");
    });
  });

  test("prompts for org selection when multiple orgs exist", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient({
        orgs: createMultiTestOrgs(),
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "hello" });

      expect(
        sent.some((message) => message.text.includes("Choose an organization"))
      ).toBe(true);
      expect(calls.createSession).toBe(0);
      expect(calls.sendStream).toBe(0);
    });
  });

  test("continues chatting after the user selects an org", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls, orgIds } = createMockClient({
        orgs: createMultiTestOrgs(),
      });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "2" });
      expect(orgIds).toContain("org_b");
      expect(
        sent.some((message) => message.text.includes("Now using Beta"))
      ).toBe(true);

      await handleMessage({ jid: PAIRED_JID, text: "hello" });
      expect(calls.createSession).toBe(1);
      expect(calls.sendStream).toBe(1);
    });
  });
});

const GROUP_JID = "120363042000000000@g.us";
const BOT_ME = {
  id: "628100000000@s.whatsapp.net",
  lid: "236283431522503@lid",
};

function groupInbound(options: {
  text: string;
  senderJid?: string;
  mentionedJids?: string[];
  quotedParticipant?: string | null;
  fromMe?: boolean;
}) {
  return {
    fromMe: options.fromMe ?? false,
    isGroup: true,
    jid: GROUP_JID,
    me: BOT_ME,
    mentionedJids: options.mentionedJids ?? [],
    quotedParticipant: options.quotedParticipant ?? null,
    senderJid: options.senderJid ?? PAIRED_JID,
    text: options.text,
  };
}

describe("createChatHandler group chats", () => {
  test("ignores plain group messages without mention", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage(groupInbound({ text: "hello everyone" }));

      expect(sent).toEqual([]);
      expect(calls.createSession).toBe(0);
      expect(calls.sendStream).toBe(0);
    });
  });

  test("group @mention triggers agent when sender is paired", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage(
        groupInbound({
          mentionedJids: [BOT_ME.id],
          text: "@Nakama hello",
        })
      );

      expect(calls.createSession).toBe(1);
      expect(calls.sendStream).toBe(1);
      expect(sessionStore.get(GROUP_JID)?.sessionId).toBe("session_test");
      expect(calls.streamInputs[0]).toEqual({
        message:
          "[WhatsApp group — your reply is visible to everyone in this group.]\nhello",
      });
      expect(sent.at(-1)?.jid).toBe(GROUP_JID);
    });
  });

  test("unpaired @mention redirects to private chat without pairing", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairingCode: "ABCD1234",
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket, sent } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage(
        groupInbound({
          mentionedJids: [BOT_ME.id],
          senderJid: "9999999999@s.whatsapp.net",
          text: "@Nakama ABCD1234",
        })
      );

      expect(sent.map((message) => message.text)).toEqual([
        "Link your account in a private chat with Nakama first.",
      ]);
      expect(calls.sendStream).toBe(0);
      expect(authStore.isAuthorized("9999999999@s.whatsapp.net")).toBe(false);
    });
  });

  test("/org in group stores selection under group org key", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client } = createMockClient({ orgs: createMultiTestOrgs() });
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage(groupInbound({ text: "/org 1" }));

      expect(orgStore.get(`g:${GROUP_JID}`)?.orgId).toBe("org_a");
      expect(orgStore.get(PAIRED_JID)).toBeUndefined();
    });
  });

  test("group and private chats keep separate sessions", async () => {
    await withTempHome(async (homeDir) => {
      await writeWhatsAppConfigIni(homeDir, {
        pairedJid: PAIRED_JID,
        phoneNumber: "1234567890",
      });

      const authStore = new WhatsAppAuthStore();
      await authStore.reload();
      const { client, calls } = createMockClient();
      const sessionStore = new SessionStore(
        path.join(homeDir, ".nakama", "whatsapp", "chat-sessions.json")
      );
      const orgStore = createTestOrgStore(homeDir);
      await orgStore.load();
      const { socket } = createMockSocket();
      const handleMessage = createChatHandler({
        authStore,
        client,
        config: { phoneNumber: "1234567890", profileId: "default" },
        getSocket: () => socket as any,
        orgStore,
        sessionStore,
      });

      await handleMessage({ jid: PAIRED_JID, text: "hello privately" });
      await handleMessage(
        groupInbound({
          mentionedJids: [BOT_ME.lid ?? BOT_ME.id],
          text: "@Nakama hello group",
        })
      );

      expect(calls.createSession).toBe(2);
      expect(sessionStore.get(PAIRED_JID)?.sessionId).toBe("session_test");
      expect(sessionStore.get(GROUP_JID)?.sessionId).toBe("session_test");
    });
  });
});
