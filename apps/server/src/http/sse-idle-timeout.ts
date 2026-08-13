/**
 * Bun.serve closes idle connections after `idleTimeout` seconds (max 255).
 * Chat SSE can sit quiet for minutes during a tool run; `: ping` comments do
 * not reliably reset that timer. Disable it per-request for SSE.
 *
 * @see https://bun.com/docs/guides/http/sse
 */
export function isSseRequest(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";

  if (accept.includes("text/event-stream")) {
    return true;
  }

  let url: URL;

  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (url.searchParams.get("stream") === "true") {
    return true;
  }

  return /\/v1\/sessions\/[^/]+\/stream$/.test(url.pathname);
}

export function disableBunIdleTimeoutForSse(
  request: Request,
  server: { timeout(request: Request, seconds: number): void }
): void {
  if (isSseRequest(request)) {
    server.timeout(request, 0);
  }
}
