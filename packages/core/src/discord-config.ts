import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { parseIni, readTextOrNull, writePrivateTextFile } from "./fs";
import { getUserConfigDir } from "./user-config";

export const DEFAULT_DISCORD_PROFILE_ID = "default";

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export interface DiscordConfigFile {
  botToken: string;
  profileId: string;
  handshakeCode: string | null;
  pairedUserIds: string[];
  allowedUserIds: string[];
}

export interface DiscordSettingsPublic {
  configured: boolean;
  botTokenMasked: string | null;
  handshakeCode: string | null;
  pairedUserIds: string[];
  allowedUserIds: string[];
  profileId: string;
  inviteUrl: string | null;
}

export interface UpdateDiscordSettingsInput {
  botToken?: string;
  allowedUserIds?: string;
  profileId?: string;
}

export function getDiscordConfigDir(): string {
  return join(getUserConfigDir(), "discord");
}

export function getDiscordConfigPath(): string {
  return join(getDiscordConfigDir(), "config.ini");
}

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const DISCORD_INVITE_PERMISSIONS = 101376; // 68608 | 32768 (Attach Files)
const DISCORD_INVITE_SCOPES = "bot applications.commands";

const discordApplicationIdCache = new Map<string, string>();

export function buildDiscordInviteUrl(applicationId: string): string {
  const params = new URLSearchParams({
    client_id: applicationId,
    permissions: String(DISCORD_INVITE_PERMISSIONS),
    scope: DISCORD_INVITE_SCOPES,
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function clearDiscordApplicationIdCache(botToken: string): void {
  discordApplicationIdCache.delete(botToken.trim());
}

export async function resolveDiscordApplicationId(botToken: string): Promise<string | null> {
  const token = botToken.trim();

  if (!token) {
    return null;
  }

  const cached = discordApplicationIdCache.get(token);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${DISCORD_API_BASE_URL}/oauth2/applications/@me`, {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { id?: string };
    const applicationId = payload.id?.trim();

    if (!applicationId || !SNOWFLAKE_PATTERN.test(applicationId)) {
      return null;
    }

    discordApplicationIdCache.set(token, applicationId);
    return applicationId;
  } catch {
    return null;
  }
}

async function withDiscordInviteUrl(
  settings: DiscordSettingsPublic,
  botToken: string | null,
): Promise<DiscordSettingsPublic> {
  if (!settings.configured || !botToken?.trim()) {
    return settings;
  }

  const applicationId = await resolveDiscordApplicationId(botToken);

  return {
    ...settings,
    inviteUrl: applicationId ? buildDiscordInviteUrl(applicationId) : null,
  };
}

export function maskBotToken(token: string): string | null {
  const trimmed = token.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 8) {
    return "••••••••";
  }

  return `${"•".repeat(Math.min(trimmed.length - 4, 12))}${trimmed.slice(-4)}`;
}

export function generateHandshakeCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function normalizeHandshakeInput(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

export function parseAllowedUserIds(raw: string): string[] {
  const ids = new Set<string>();

  for (const part of raw.split(",")) {
    const trimmed = part.trim();

    if (!trimmed) {
      continue;
    }

    if (!SNOWFLAKE_PATTERN.test(trimmed)) {
      throw new Error(`Invalid Discord user ID: ${trimmed}`);
    }

    ids.add(trimmed);
  }

  return [...ids];
}

export function isDiscordUserAuthorized(
  userId: string,
  config: Pick<DiscordConfigFile, "pairedUserIds" | "allowedUserIds">,
): boolean {
  return config.pairedUserIds.includes(userId) || config.allowedUserIds.includes(userId);
}

async function loadDiscordConfigFile(): Promise<DiscordConfigFile | null> {
  const raw = await readTextOrNull(getDiscordConfigPath());

  if (raw === null) {
    return null;
  }

  const values = parseIni(raw);
  const botToken = values.bot_token?.trim() ?? "";
  const profileId = values.profile_id?.trim() || DEFAULT_DISCORD_PROFILE_ID;
  const handshakeCode = values.handshake_code?.trim() || null;
  const pairedRaw = values.paired_user_ids?.trim() ?? "";
  const allowlistRaw = values.allowed_user_ids?.trim() ?? "";

  if (!botToken) {
    return null;
  }

  return {
    botToken,
    profileId,
    handshakeCode,
    pairedUserIds: pairedRaw ? parseAllowedUserIds(pairedRaw) : [],
    allowedUserIds: allowlistRaw ? parseAllowedUserIds(allowlistRaw) : [],
  };
}

export { loadDiscordConfigFile };

export function toDiscordSettingsPublic(file: DiscordConfigFile | null): DiscordSettingsPublic {
  if (!file) {
    return {
      configured: false,
      botTokenMasked: null,
      handshakeCode: null,
      pairedUserIds: [],
      allowedUserIds: [],
      profileId: DEFAULT_DISCORD_PROFILE_ID,
      inviteUrl: null,
    };
  }

  return {
    configured: Boolean(file.botToken.trim()),
    botTokenMasked: maskBotToken(file.botToken),
    handshakeCode: file.handshakeCode,
    pairedUserIds: file.pairedUserIds,
    allowedUserIds: file.allowedUserIds,
    profileId: file.profileId,
    inviteUrl: null,
  };
}

export async function loadDiscordSettingsPublic(): Promise<DiscordSettingsPublic> {
  const file = await loadDiscordConfigFile();
  const base = toDiscordSettingsPublic(file);
  return withDiscordInviteUrl(base, file?.botToken ?? null);
}

async function writeDiscordConfigFile(config: DiscordConfigFile): Promise<void> {
  const lines = [
    "# Nakama Discord bridge",
    `bot_token=${config.botToken}`,
    `profile_id=${config.profileId}`,
    ...(config.handshakeCode ? [`handshake_code=${config.handshakeCode}`] : []),
    ...(config.pairedUserIds.length > 0
      ? [`paired_user_ids=${config.pairedUserIds.join(",")}`]
      : []),
    ...(config.allowedUserIds.length > 0
      ? [`allowed_user_ids=${config.allowedUserIds.join(",")}`]
      : []),
    "",
  ];

  await writePrivateTextFile(getDiscordConfigPath(), lines.join("\n"), {
    ensureDir: getDiscordConfigDir(),
  });
}

function resolveDiscordBotToken(
  input: UpdateDiscordSettingsInput,
  existing: DiscordConfigFile | null,
): string {
  return input.botToken !== undefined ? input.botToken.trim() : (existing?.botToken ?? "");
}

function resolveDiscordProfileId(
  input: UpdateDiscordSettingsInput,
  existing: DiscordConfigFile | null,
): string {
  return input.profileId?.trim() || existing?.profileId || DEFAULT_DISCORD_PROFILE_ID;
}

function resolveAllowedUserIdsInput(
  input: UpdateDiscordSettingsInput,
  existing: DiscordConfigFile | null,
): string[] {
  const raw =
    input.allowedUserIds !== undefined
      ? input.allowedUserIds.trim()
      : (existing?.allowedUserIds.join(",") ?? "");

  return raw ? parseAllowedUserIds(raw) : [];
}

function resolveHandshakeCode(
  existing: DiscordConfigFile | null,
  allowedUserIds: string[],
): string | null {
  const pairedUserIds = existing?.pairedUserIds ?? [];
  const handshakeCode = existing?.handshakeCode ?? null;

  if (pairedUserIds.length > 0 || allowedUserIds.length > 0 || handshakeCode) {
    return handshakeCode;
  }

  return generateHandshakeCode();
}

function buildSavedDiscordConfig(
  input: UpdateDiscordSettingsInput,
  existing: DiscordConfigFile | null,
): DiscordConfigFile {
  const botToken = resolveDiscordBotToken(input, existing);

  if (!botToken) {
    throw new Error("Bot token is required.");
  }

  const allowedUserIds = resolveAllowedUserIdsInput(input, existing);

  return {
    botToken,
    profileId: resolveDiscordProfileId(input, existing),
    handshakeCode: resolveHandshakeCode(existing, allowedUserIds),
    pairedUserIds: existing?.pairedUserIds ?? [],
    allowedUserIds,
  };
}

export async function saveDiscordConfig(
  input: UpdateDiscordSettingsInput,
): Promise<DiscordSettingsPublic> {
  const existing = await loadDiscordConfigFile();
  const next = buildSavedDiscordConfig(input, existing);

  if (existing?.botToken.trim() && existing.botToken.trim() !== next.botToken.trim()) {
    clearDiscordApplicationIdCache(existing.botToken);
  }

  await writeDiscordConfigFile(next);
  return withDiscordInviteUrl(toDiscordSettingsPublic(next), next.botToken);
}

export async function regenerateDiscordHandshake(): Promise<DiscordSettingsPublic> {
  const existing = await loadDiscordConfigFile();

  if (!existing?.botToken.trim()) {
    throw new Error("Save a bot token before generating a pairing code.");
  }

  const next: DiscordConfigFile = {
    ...existing,
    handshakeCode: generateHandshakeCode(),
  };

  await writeDiscordConfigFile(next);
  return withDiscordInviteUrl(toDiscordSettingsPublic(next), next.botToken);
}

export async function verifyAndPairDiscordUser(
  handshakeInput: string,
  userId: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const config = await loadDiscordConfigFile();

  if (!config) {
    return { ok: false, message: "Discord is not configured on the server yet." };
  }

  if (isDiscordUserAuthorized(userId, config)) {
    return { ok: true, message: "This chat is already linked." };
  }

  const expected = config.handshakeCode;

  if (!expected) {
    return {
      ok: false,
      message:
        "No pairing code is active. Open Nakama Integrations → Discord and generate a new code.",
    };
  }

  if (normalizeHandshakeInput(handshakeInput) !== normalizeHandshakeInput(expected)) {
    return {
      ok: false,
      message: "Invalid pairing code. Copy it from Integrations → Discord and try again.",
    };
  }

  const pairedUserIds = [...new Set([...config.pairedUserIds, userId])];

  await writeDiscordConfigFile({
    ...config,
    pairedUserIds,
    handshakeCode: null,
  });

  return {
    ok: true,
    message: "Linked successfully. You can chat with Nakama now.",
  };
}

export function resolveDiscordConfigFromSources(options: {
  env?: Record<string, string | undefined>;
  file?: DiscordConfigFile | null;
}): DiscordConfigFile | null {
  const env = options.env ?? process.env;
  const file = options.file ?? null;
  const botToken = env.DISCORD_BOT_TOKEN?.trim() || file?.botToken?.trim() || "";

  if (!botToken) {
    return null;
  }

  const envAllowlist = env.DISCORD_ALLOWED_USER_IDS?.trim();

  return {
    botToken,
    profileId:
      env.nakama_DISCORD_PROFILE_ID?.trim() ||
      file?.profileId?.trim() ||
      DEFAULT_DISCORD_PROFILE_ID,
    handshakeCode: file?.handshakeCode ?? null,
    pairedUserIds: file?.pairedUserIds ?? [],
    allowedUserIds: envAllowlist
      ? parseAllowedUserIds(envAllowlist)
      : (file?.allowedUserIds ?? []),
  };
}
