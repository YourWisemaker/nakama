import { describe, expect, test } from "bun:test";
import { disableBunIdleTimeoutForSse, isSseRequest } from "./sse-idle-timeout";

describe("isSseRequest", () => {
  test("matches Accept text/event-stream", () => {
    expect(
      isSseRequest(
        new Request("http://127.0.0.1:4310/v1/sessions/abc/messages", {
          headers: { Accept: "text/event-stream" },
          method: "POST",
        })
      )
    ).toBe(true);
  });

  test("matches stream=true query even without Accept", () => {
    expect(
      isSseRequest(
        new Request(
          "http://127.0.0.1:4310/v1/sessions/abc/messages?stream=true",
          {
            method: "POST",
          }
        )
      )
    ).toBe(true);
  });

  test("matches session subscribe path", () => {
    expect(
      isSseRequest(
        new Request("http://127.0.0.1:4310/v1/sessions/abc/stream", {
          method: "GET",
        })
      )
    ).toBe(true);
  });

  test("does not match ordinary JSON chat", () => {
    expect(
      isSseRequest(
        new Request("http://127.0.0.1:4310/v1/sessions/abc/messages", {
          headers: { Accept: "application/json" },
          method: "POST",
        })
      )
    ).toBe(false);
  });
});

describe("disableBunIdleTimeoutForSse", () => {
  test("calls server.timeout(request, 0) for SSE", () => {
    const request = new Request(
      "http://127.0.0.1:4310/v1/sessions/abc/messages?stream=true",
      { method: "POST" }
    );
    const calls: Array<{ request: Request; seconds: number }> = [];

    disableBunIdleTimeoutForSse(request, {
      timeout(req, seconds) {
        calls.push({ request: req, seconds });
      },
    });

    expect(calls).toEqual([{ request, seconds: 0 }]);
  });

  test("leaves non-SSE requests on the default idle timeout", () => {
    const request = new Request("http://127.0.0.1:4310/health");
    let called = false;

    disableBunIdleTimeoutForSse(request, {
      timeout() {
        called = true;
      },
    });

    expect(called).toBe(false);
  });
});
