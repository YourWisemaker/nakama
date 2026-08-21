import { join } from "node:path";
import {
  ChannelSessionStore,
  type ChatSessionRecord,
} from "@nakama/core/channel-session-store";
import { getTelegramConfigDir } from "@nakama/core/telegram-config";

export type { ChatSessionRecord };

export class SessionStore extends ChannelSessionStore {
  constructor(path = join(getTelegramConfigDir(), "chat-sessions.json")) {
    super(path);
  }
}
