import type { StreamEvent } from "@nakama/core";

const MAX_BUFFER_EVENTS = 10_000;
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const MAX_SUBSCRIBERS_PER_SESSION = 3;

export interface BeginTurnResult {
  started: boolean;
}

export interface TurnStatus {
  active: boolean;
  startedAt?: string;
}

type Subscriber = {
  push: (event: StreamEvent) => void;
  close: () => void;
};

type ActiveTurn = {
  startedAt: string;
  events: StreamEvent[];
  bufferBytes: number;
  subscribers: Set<Subscriber>;
};

function estimateEventBytes(event: StreamEvent): number {
  try {
    return JSON.stringify(event).length;
  } catch {
    return 256;
  }
}

function isTerminalEvent(event: StreamEvent): boolean {
  return event.type === "done" || event.type === "error";
}

function snapshotKey(event: StreamEvent): string | null {
  switch (event.type) {
    case "chunk":
    case "thinking":
      return `leg:${event.type}`;
    case "tool_input_delta":
      return `tool_input:${event.toolCallId}`;
    case "todos_updated":
      return "todos_updated";
    case "questionnaire_updated":
      return "questionnaire_updated";
    default:
      return null;
  }
}

function compactBuffer(events: StreamEvent[]): StreamEvent[] {
  const snapshotIndexes = new Map<string, number>();

  for (let index = 0; index < events.length; index += 1) {
    const key = snapshotKey(events[index]!);
    if (key) {
      snapshotIndexes.set(key, index);
    }
  }

  const keep = new Set<number>();
  for (const index of snapshotIndexes.values()) {
    keep.add(index);
  }

  for (let index = events.length - 1; index >= 0 && keep.size < MAX_BUFFER_EVENTS; index -= 1) {
    if (!keep.has(index)) {
      keep.add(index);
    }
  }

  return events.filter((_, index) => keep.has(index));
}

function trimBuffer(turn: ActiveTurn): void {
  while (
    turn.events.length > MAX_BUFFER_EVENTS ||
    turn.bufferBytes > MAX_BUFFER_BYTES
  ) {
    if (turn.events.length <= 1) {
      break;
    }

    turn.events = compactBuffer(turn.events);
    turn.bufferBytes = turn.events.reduce(
      (total, event) => total + estimateEventBytes(event),
      0,
    );

    if (turn.events.length > MAX_BUFFER_EVENTS) {
      const removed = turn.events.shift();
      if (removed) {
        turn.bufferBytes -= estimateEventBytes(removed);
      }
    }
  }
}

export class SessionTurnRegistry {
  private readonly turns = new Map<string, ActiveTurn>();

  beginTurn(sessionId: string): BeginTurnResult {
    if (this.turns.has(sessionId)) {
      return { started: false };
    }

    this.turns.set(sessionId, {
      startedAt: new Date().toISOString(),
      events: [],
      bufferBytes: 0,
      subscribers: new Set(),
    });

    return { started: true };
  }

  getStatus(sessionId: string): TurnStatus {
    const turn = this.turns.get(sessionId);
    if (!turn) {
      return { active: false };
    }

    return { active: true, startedAt: turn.startedAt };
  }

  isActive(sessionId: string): boolean {
    return this.turns.has(sessionId);
  }

  publish(sessionId: string, event: StreamEvent): void {
    const turn = this.turns.get(sessionId);
    if (!turn) {
      return;
    }

    turn.events.push(event);
    turn.bufferBytes += estimateEventBytes(event);
    trimBuffer(turn);

    for (const subscriber of turn.subscribers) {
      subscriber.push(event);
    }
  }

  subscribe(
    sessionId: string,
    onEvent: (event: StreamEvent) => void,
  ): { unsubscribe: () => void } | null {
    const turn = this.turns.get(sessionId);
    if (!turn) {
      return null;
    }

    if (turn.subscribers.size >= MAX_SUBSCRIBERS_PER_SESSION) {
      return null;
    }

    const subscriber: Subscriber = {
      push: onEvent,
      close: () => {
        turn.subscribers.delete(subscriber);
      },
    };

    turn.subscribers.add(subscriber);

    for (const event of turn.events) {
      onEvent(event);
    }

    return { unsubscribe: subscriber.close };
  }

  endTurn(sessionId: string, terminal: StreamEvent): void {
    const turn = this.turns.get(sessionId);
    if (!turn) {
      return;
    }

    if (!isTerminalEvent(terminal)) {
      this.publish(sessionId, terminal);
    } else if (!turn.events.some(isTerminalEvent)) {
      turn.events.push(terminal);
      for (const subscriber of turn.subscribers) {
        subscriber.push(terminal);
      }
    }

    for (const subscriber of turn.subscribers) {
      subscriber.close();
    }

    this.turns.delete(sessionId);
  }
}

export const sessionTurnRegistry = new SessionTurnRegistry();
