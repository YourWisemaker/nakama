import {
  type ErrorReport,
  type ErrorSink,
  refreshErrorTrackingEnabled,
  setErrorSink,
} from "./error-tracking";
import {
  loadErrorTrackingConfig,
  resolveErrorTrackingDsn,
} from "./error-tracking-config";

const SEND_TIMEOUT_MS = 3000;
const SENTRY_CLIENT = "nakama/1";

export interface SentryDsn {
  endpoint: string;
  publicKey: string;
}

/**
 * One protocol covers Sentry, GlitchTip, Bugsink and self-hosted Sentry: they all accept
 * the same store endpoint and X-Sentry-Auth header, so the operator picks the platform
 * and nakama does not have to know which one it is talking to.
 */
export function parseSentryDsn(dsn: string): SentryDsn | null {
  const trimmed = dsn.trim();

  if (!trimmed) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const publicKey = url.username;
  const segments = url.pathname.split("/").filter(Boolean);
  const projectId = segments.pop();

  if (!(publicKey && projectId)) {
    return null;
  }

  const prefix = segments.length > 0 ? `/${segments.join("/")}` : "";

  return {
    endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/store/`,
    publicKey,
  };
}

export function toSentryEvent(report: ErrorReport): Record<string, unknown> {
  return {
    contexts: {
      os: { name: report.runtime.platform },
      runtime: { name: "bun", version: report.runtime.bun },
    },
    // The report's own id, so the queued copy and the live send land as one event.
    event_id: report.id.replace(/-/g, ""),
    exception: {
      values: [{ type: report.name, value: report.message }],
    },
    ...(report.stack ? { extra: { stack: report.stack } } : {}),
    // Grouping is ours rather than the ingest's, so one bug stays one issue even when
    // stack frames differ between installs.
    fingerprint: [report.fingerprint],
    level: report.kind === "test" ? "info" : "error",
    logger: "nakama",
    platform: "node",
    tags: {
      api_version: String(report.runtime.apiVersion),
      arch: report.runtime.arch,
      bun: report.runtime.bun,
      kind: report.kind,
      os: report.runtime.platform,
      source: report.source,
    },
    timestamp: report.at,
    // server_name is deliberately absent. Sentry defaults it to the hostname, which on
    // a self-hosted install is often the operator's own machine or cluster name.
  };
}

export async function sendSentryEvent(
  dsn: SentryDsn,
  event: Record<string, unknown>,
  timeoutMs = SEND_TIMEOUT_MS
): Promise<boolean> {
  try {
    const response = await fetch(dsn.endpoint, {
      body: JSON.stringify(event),
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=${SENTRY_CLIENT}, sentry_key=${dsn.publicKey}`,
      },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Resolves the DSN per send, so saving one from the Integrations tab starts delivery
 * without a restart and clearing it stops delivery just as fast.
 */
export function createErrorTrackingSink(): ErrorSink {
  return async (report) => {
    const config = await loadErrorTrackingConfig();
    const dsn = parseSentryDsn(resolveErrorTrackingDsn(config) ?? "");

    if (!dsn) {
      return false;
    }

    return await sendSentryEvent(dsn, toSentryEvent(report));
  };
}

/**
 * Refreshes the enabled flag as part of installing, so the sink and the flag can
 * never disagree about whether the integration is on.
 */
export async function installErrorTrackingSink(): Promise<void> {
  setErrorSink(createErrorTrackingSink());
  await refreshErrorTrackingEnabled();
}
