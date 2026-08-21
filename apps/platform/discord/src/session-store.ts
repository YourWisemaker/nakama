import { join } from "node:path";
import { ChannelSessionStore } from "@nakama/core/channel-session-store";
import { getDiscordConfigDir } from "@nakama/core/discord-config";

export class SessionStore extends ChannelSessionStore {
  constructor(path = join(getDiscordConfigDir(), "chat-sessions.json")) {
    super(path);
  }
}
