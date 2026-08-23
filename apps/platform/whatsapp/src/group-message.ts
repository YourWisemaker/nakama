import { areJidsSameUser, isJidGroup } from "@whiskeysockets/baileys";

export interface WhatsAppAccount {
  id: string;
  lid?: string | null;
}

export interface GroupMessageHandlingDecision {
  reason:
    | "slash-command"
    | "missing-bot-info"
    | "reply-to-bot"
    | "bot-mention"
    | "no-text"
    | "no-trigger";
  shouldHandle: boolean;
}

export function isWhatsAppGroupChat(jid: string): boolean {
  return Boolean(isJidGroup(jid));
}

export function resolveChannelOrgKey(jid: string, isGroup: boolean): string {
  return isGroup ? `g:${jid}` : jid;
}

export function isWhatsAppBotAddress(
  jid: string | null | undefined,
  me: WhatsAppAccount | undefined
): boolean {
  if (!(jid && me)) {
    return false;
  }

  if (areJidsSameUser(jid, me.id)) {
    return true;
  }

  return Boolean(me.lid && areJidsSameUser(jid, me.lid));
}

export function explainGroupMessageHandling(input: {
  mentionedJids: string[];
  quotedParticipant: string | null;
  text: string;
  me?: WhatsAppAccount | undefined;
}): GroupMessageHandlingDecision {
  const text = input.text.trim();

  if (text.startsWith("/")) {
    return { reason: "slash-command", shouldHandle: true };
  }

  if (!input.me) {
    return { reason: "missing-bot-info", shouldHandle: false };
  }

  if (isWhatsAppBotAddress(input.quotedParticipant, input.me)) {
    return { reason: "reply-to-bot", shouldHandle: true };
  }

  if (input.mentionedJids.some((jid) => isWhatsAppBotAddress(jid, input.me))) {
    return { reason: "bot-mention", shouldHandle: true };
  }

  return {
    reason: text ? "no-trigger" : "no-text",
    shouldHandle: false,
  };
}

export function stripWhatsAppBotMention(text: string): string {
  return text.replace(/@\S+/g, "").replace(/\s+/g, " ").trim();
}
