import { join } from "node:path";
import {
  ChannelSessionStore,
  type ChatSessionRecord,
} from "@nakama/core/channel-session-store";
import { getDiscordConfigDir } from "@nakama/core/discord-config";

export type { ChatSessionRecord };

export class SessionStore extends ChannelSessionStore {
  constructor(path = join(getDiscordConfigDir(), "chat-sessions.json")) {
    super(path);
  }
}
