import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInMemoryDatabaseAdapter } from "@nakama/db";
import { AgentService } from "../../services/agent-service";
import { AuthService } from "../../services/auth-service";
import { createMinimalHonoApp } from "../test-app-helpers";
import { loginUserSession, seedOrgAdmin } from "../test-session-helpers";

const DSN = "https://publickey@errors.example.com/42";

async function createApp() {
  process.env.NAKAMA_CONFIG_DIR = await mkdtemp(
    join(tmpdir(), "nakama-error-tracking-route-")
  );

  const databaseAdapter = createInMemoryDatabaseAdapter();
  const authService = new AuthService();

  return createMinimalHonoApp({
    agent: new AgentService(null, null, databaseAdapter),
    authService,
    databaseAdapter,
  });
}

async function seedMember(
  databaseAdapter: ReturnType<typeof createInMemoryDatabaseAdapter>,
  authService: AuthService,
  role: "member" | "viewer"
) {
  const now = new Date().toISOString();
  const email = `${role}@example.com`;
  const password = "password123";

  await databaseAdapter.createUser({
    createdAt: now,
    email,
    id: `user_${role}`,
    passwordHash: await authService.hashPassword(password),
    updatedAt: now,
  });
  await databaseAdapter.upsertOrganization({
    createdAt: now,
    id: "org_test",
    name: "Test Org",
    slug: "test-org",
    updatedAt: now,
  });
  await databaseAdapter.upsertOrgMember({
    createdAt: now,
    orgId: "org_test",
    role,
    userId: `user_${role}`,
  });

  return { email, orgId: "org_test", password };
}

describe("error tracking routes", () => {
  test("an org admin saves a DSN and reads it back masked", async () => {
    const { app, databaseAdapter } = await createApp();
    const { email, password, orgId } = await seedOrgAdmin(databaseAdapter);
    const session = await loginUserSession(app, email, password, orgId);

    const saved = await app.fetch(
      new Request("http://localhost:4310/v1/settings/error-tracking", {
        body: JSON.stringify({ dsn: DSN }),
        headers: session.headers({
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        }),
        method: "PUT",
      })
    );

    expect(saved.status).toBe(200);
    const body = (await saved.json()) as {
      configured: boolean;
      dsnMasked: string | null;
    };
    expect(body.configured).toBe(true);
    // The whole point of the masked field: the response must not carry the key.
    expect(body.dsnMasked).not.toContain("publickey");
    expect(JSON.stringify(body)).not.toContain(DSN);
  });

  test("an empty DSN clears a saved one instead of keeping it", async () => {
    const { app, databaseAdapter } = await createApp();
    const { email, password, orgId } = await seedOrgAdmin(databaseAdapter);
    const session = await loginUserSession(app, email, password, orgId);

    const put = (dsn: string) =>
      app.fetch(
        new Request("http://localhost:4310/v1/settings/error-tracking", {
          body: JSON.stringify({ dsn }),
          headers: session.headers({
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          }),
          method: "PUT",
        })
      );

    await put(DSN);
    const cleared = await put("");

    expect(cleared.status).toBe(200);
    // Off has to be reachable from the same field that turned it on, or an operator
    // who wants delivery stopped has to go and edit config.ini by hand.
    expect(await cleared.json()).toMatchObject({
      configured: false,
      dsnMasked: null,
    });
  });

  test("a malformed DSN is rejected instead of being saved", async () => {
    const { app, databaseAdapter } = await createApp();
    const { email, password, orgId } = await seedOrgAdmin(databaseAdapter);
    const session = await loginUserSession(app, email, password, orgId);

    const response = await app.fetch(
      new Request("http://localhost:4310/v1/settings/error-tracking", {
        body: JSON.stringify({ dsn: "not-a-dsn" }),
        headers: session.headers({
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        }),
        method: "PUT",
      })
    );

    expect(response.status).toBe(400);
  });

  for (const role of ["member", "viewer"] as const) {
    test(`a ${role} cannot write the workspace-wide DSN`, async () => {
      const { app, databaseAdapter, authService } = await createApp();
      const { email, password, orgId } = await seedMember(
        databaseAdapter,
        authService,
        role
      );
      const session = await loginUserSession(app, email, password, orgId);

      const response = await app.fetch(
        new Request("http://localhost:4310/v1/settings/error-tracking", {
          body: JSON.stringify({ dsn: DSN }),
          headers: session.headers({
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          }),
          method: "PUT",
        })
      );

      expect(response.status).toBe(403);
    });
  }

  test("the test event is refused before a DSN is saved", async () => {
    const { app, databaseAdapter } = await createApp();
    const { email, password, orgId } = await seedOrgAdmin(databaseAdapter);
    const session = await loginUserSession(app, email, password, orgId);

    const response = await app.fetch(
      new Request("http://localhost:4310/v1/settings/error-tracking/test", {
        headers: session.headers({ "X-CSRF-Token": session.csrfToken }),
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
  });
});
