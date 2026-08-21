import type { AgentChannel, ToolContext, ToolDefinition } from "@nakama/core";

const AGENT_CHANNELS: AgentChannel[] = [
  "web",
  "cli",
  "telegram",
  "whatsapp",
  "discord",
  "automation",
  "task",
  "subagent",
];

/**
 * Matches `GET /v1/sessions`, which reads `channel` from the query string and
 * falls back to "web" rather than merging channels.
 */
const DEFAULT_CHANNEL: AgentChannel = "web";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface SessionSummaryForTool {
  channel: AgentChannel;
  createdAt?: string;
  id: string;
  messageCount?: number;
  preview?: string | null;
  profileId: string;
  title?: string | null;
  updatedAt?: string;
}

interface SessionTranscript {
  channel: AgentChannel;
  messages: unknown[];
  profileId: string;
  returnedMessages: number;
  totalMessages: number;
}

/**
 * The slice of AgentService these tools need. Both methods already reject
 * anything outside the caller's org, so the tools add no boundary of their own.
 */
export interface SessionReader {
  listSessions(
    orgId: string,
    profileId: string,
    channel: AgentChannel
  ): Promise<{ sessions: SessionSummaryForTool[] }>;
  readSessionTranscript(
    sessionId: string,
    orgId: string,
    options: { limit: number; offset: number }
  ): Promise<SessionTranscript | null>;
}

function requireOrgId(context: ToolContext): string {
  const orgId = context.orgId?.trim();

  if (!orgId) {
    throw new Error("Organization context is required.");
  }

  return orgId;
}

function readString(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return null;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readChannel(input: unknown): AgentChannel {
  const value = readString(input, "channel");

  if (!value) {
    return DEFAULT_CHANNEL;
  }

  const channel = AGENT_CHANNELS.find((candidate) => candidate === value);

  if (!channel) {
    throw new Error(`Unknown channel: ${value}.`);
  }

  return channel;
}

function readBoundedInteger(
  input: unknown,
  key: string,
  fallback: number,
  max: number
): number {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return fallback;
  }

  const value = (input as Record<string, unknown>)[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 0), max);
}

export function createSessionTools(reader: SessionReader): ToolDefinition[] {
  return [
    {
      description:
        "List the chat sessions of another agent profile in this organization, newest activity first. Use it to find a session id before reading its transcript. Sessions with no messages are not listed. Profiles outside this organization are not visible.",
      name: "list_profile_sessions",
      parallelSafe: true,
      parameters: {
        additionalProperties: false,
        properties: {
          channel: {
            description:
              "Which channel's sessions to list. Defaults to web, the same default the sessions API uses.",
            enum: AGENT_CHANNELS,
            type: "string",
          },
          profileId: {
            description: "Id of the profile whose sessions you want to list.",
            type: "string",
          },
        },
        required: ["profileId"],
        type: "object",
      },
      async run(input, context: ToolContext) {
        const orgId = requireOrgId(context);
        const profileId = readString(input, "profileId");

        if (!profileId) {
          throw new Error("profileId is required.");
        }

        return await reader.listSessions(orgId, profileId, readChannel(input));
      },
    },
    {
      description:
        "Read the stored transcript of a session belonging to another agent profile in this organization. Returns messages as they were persisted, so a session with a turn still running is returned as of its last completed turn. Sessions outside this organization are not readable.",
      name: "read_profile_session",
      parallelSafe: true,
      parameters: {
        additionalProperties: false,
        properties: {
          limit: {
            description: `How many messages to return, newest last. Defaults to ${DEFAULT_LIMIT}, capped at ${MAX_LIMIT}.`,
            type: "number",
          },
          offset: {
            description:
              "How many messages to skip from the start of the transcript. Use it with limit to page through a long session.",
            type: "number",
          },
          sessionId: {
            description: "Id of the session to read.",
            type: "string",
          },
        },
        required: ["sessionId"],
        type: "object",
      },
      async run(input, context: ToolContext) {
        const orgId = requireOrgId(context);
        const sessionId = readString(input, "sessionId");

        if (!sessionId) {
          throw new Error("sessionId is required.");
        }

        const transcript = await reader.readSessionTranscript(
          sessionId,
          orgId,
          {
            limit: readBoundedInteger(input, "limit", DEFAULT_LIMIT, MAX_LIMIT),
            offset: readBoundedInteger(
              input,
              "offset",
              0,
              Number.MAX_SAFE_INTEGER
            ),
          }
        );

        if (!transcript) {
          throw new Error("Session not found.");
        }

        return transcript;
      },
    },
  ];
}
