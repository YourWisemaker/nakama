import {
  areJidsSameUser,
  extractMessageContent,
  isJidGroup,
  isJidUser,
  isLidUser,
  type proto,
} from "@whiskeysockets/baileys";
import {
  explainGroupMessageHandling,
  type WhatsAppAccount,
} from "./group-message";

interface WhatsAppInboundKey {
  fromMe?: boolean | null;
  participant?: string | null;
  participantPn?: string | null;
  remoteJid?: string | null;
}

export interface WhatsAppInboundChat {
  fromMe: boolean;
  isGroup: boolean;
  jid: string;
  me?: WhatsAppAccount;
  mentionedJids: string[];
  quotedParticipant: string | null;
  senderJid: string;
  text: string;
}

export function isPrivateWhatsAppChat(jid: string): boolean {
  return isJidUser(jid) || isLidUser(jid);
}

export function isSelfWhatsAppChat(
  remoteJid: string,
  me: WhatsAppAccount | undefined
): boolean {
  if (!me) {
    return false;
  }

  if (areJidsSameUser(remoteJid, me.id)) {
    return true;
  }

  return Boolean(me.lid && areJidsSameUser(remoteJid, me.lid));
}

export function extractInboundText(
  message: proto.IMessage | null | undefined
): string {
  if (!message) {
    return "";
  }

  const extracted = extractMessageContent(message) ?? message;
  const direct = readTextContent(extracted);

  if (direct) {
    return direct;
  }

  const materialized = materializeMessage(extracted);
  return readTextContent(materialized);
}

function extractMentionedJids(
  message: proto.IMessage | null | undefined
): string[] {
  return (
    extractContextInfo(message)?.mentionedJid?.filter((jid): jid is string =>
      Boolean(jid)
    ) ?? []
  );
}

function extractQuotedParticipant(
  message: proto.IMessage | null | undefined
): string | null {
  return extractContextInfo(message)?.participant ?? null;
}

export function shouldHandleInboundMessage(
  msg: {
    key: WhatsAppInboundKey;
    message?: proto.IMessage | null;
  },
  me: WhatsAppAccount | undefined
): boolean {
  return parseInboundWhatsAppMessage(msg, me) !== null;
}

export function parseInboundWhatsAppMessage(
  msg: {
    key: WhatsAppInboundKey;
    message?: proto.IMessage | null;
  },
  me: WhatsAppAccount | undefined
): WhatsAppInboundChat | null {
  const remoteJid = msg.key.remoteJid;
  const text = extractInboundText(msg.message);

  if (!(remoteJid && text)) {
    return null;
  }

  const isGroup = Boolean(isJidGroup(remoteJid));
  const fromMe = Boolean(msg.key.fromMe);
  const mentionedJids = extractMentionedJids(msg.message);
  const quotedParticipant = extractQuotedParticipant(msg.message);

  if (isGroup) {
    const decision = explainGroupMessageHandling({
      me,
      mentionedJids,
      quotedParticipant,
      text,
    });

    if (!decision.shouldHandle) {
      return null;
    }
  } else if (!isPrivateWhatsAppChat(remoteJid)) {
    return null;
  } else if (fromMe && !isSelfWhatsAppChat(remoteJid, me)) {
    return null;
  }

  const senderJid = resolveSenderJid(msg.key, remoteJid, isGroup, me);

  if (isGroup && !senderJid) {
    return null;
  }

  return {
    fromMe,
    isGroup,
    jid: remoteJid,
    me,
    mentionedJids,
    quotedParticipant,
    senderJid,
    text,
  };
}

function resolveSenderJid(
  key: WhatsAppInboundKey,
  remoteJid: string,
  isGroup: boolean,
  me: WhatsAppAccount | undefined
): string {
  if (!isGroup) {
    return remoteJid;
  }

  return (
    key.participantPn ?? key.participant ?? (key.fromMe && me ? me.id : "")
  );
}

function extractContextInfo(
  message: proto.IMessage | null | undefined
): proto.IContextInfo | undefined {
  if (!message) {
    return;
  }

  const extracted = extractMessageContent(message) ?? message;
  const materialized = materializeMessage(extracted) ?? extracted;

  return (
    materialized.extendedTextMessage?.contextInfo ??
    materialized.imageMessage?.contextInfo ??
    materialized.videoMessage?.contextInfo ??
    materialized.documentMessage?.contextInfo ??
    undefined
  );
}

function readTextContent(
  message: Partial<proto.IMessage> | null | undefined
): string {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    ""
  ).trim();
}

function materializeMessage(
  message: Partial<proto.IMessage> | null | undefined
): Partial<proto.IMessage> | null {
  if (!message) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(message)) as Partial<proto.IMessage>;
  } catch {
    return null;
  }
}
