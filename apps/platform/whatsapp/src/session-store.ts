import { join } from "node:path";
import { ChannelSessionStore } from "@nakama/core/channel-session-store";
import { getWhatsAppConfigDir } from "@nakama/core/whatsapp-config";

export class SessionStore extends ChannelSessionStore {
  constructor(path = join(getWhatsAppConfigDir(), "chat-sessions.json")) {
    super(path);
  }
}
