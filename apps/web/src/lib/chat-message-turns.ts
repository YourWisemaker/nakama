import type { ChatListItem } from "@/lib/chat-history";

export type IndexedMessage = { message: ChatListItem; index: number };

export type MessageTurn =
  | { kind: "user"; message: ChatListItem; index: number }
  | { kind: "assistant"; messages: IndexedMessage[] };

export function groupMessagesIntoTurns(messages: ChatListItem[]): MessageTurn[] {
  const turns: MessageTurn[] = [];
  let currentAssistantTurn: IndexedMessage[] | null = null;

  for (const [index, message] of messages.entries()) {
    if (message.role === "user") {
      if (currentAssistantTurn) {
        turns.push({ kind: "assistant", messages: currentAssistantTurn });
        currentAssistantTurn = null;
      }

      turns.push({ kind: "user", message, index });
      continue;
    }

    currentAssistantTurn ??= [];
    currentAssistantTurn.push({ message, index });
  }

  if (currentAssistantTurn) {
    turns.push({ kind: "assistant", messages: currentAssistantTurn });
  }

  return turns;
}

export function turnKey(turn: MessageTurn): string {
  if (turn.kind === "user") {
    return turn.message.id;
  }

  return turn.messages.map(({ message }) => message.id).join(":");
}
