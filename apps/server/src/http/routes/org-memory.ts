import { createRoute, z } from "@hono/zod-openapi";
import { NakamaApiError } from "@nakama/core";
import type {
  AddOrgMemoryFactRequest,
  ArchiveOrgMemoryRequest,
  ArchiveOrgMemoryResponse,
  OrgMemoryResponse,
  OrgMemorySearchRequest,
  OrgMemorySearchResponse,
  PinOrgMemoryRequest,
  UnpinOrgMemoryRequest,
  UpdateOrgMemoryRequest,
} from "@nakama/core/contract";
import type { HonoApp } from "../types";
import type { ServerOptions } from "../context";
import { json, readJson } from "../shared";
import { requireOrgAdminFromContext, requireNotViewerFromContext } from "../org-guards";

export function registerOrgMemoryRoutes(app: HonoApp, options: ServerOptions): void {
  const orgMemoryService = options.orgMemoryService;
  const errorSchema = z.object({ error: z.string() }).openapi("ApiErrorResponse");
  const orgIdParam = z.object({
    orgId: z.string().openapi({ param: { name: "orgId", in: "path" } }),
  });
  const orgMemoryResponseSchema = z.object({}).passthrough().openapi("OrgMemoryResponse");
  const updateOrgMemorySchema = z
    .object({ content: z.string() })
    .openapi("UpdateOrgMemoryRequest");
  const addOrgMemoryFactSchema = z
    .object({ bullet: z.string(), pin: z.boolean().optional() })
    .openapi("AddOrgMemoryFactRequest");
  const orgMemorySearchSchema = z.object({ query: z.string() }).openapi("OrgMemorySearchRequest");
  const orgMemorySearchResponseSchema = z
    .object({})
    .passthrough()
    .openapi("OrgMemorySearchResponse");
  const archiveOrgMemorySchema = z
    .object({ entries: z.array(z.string()), reason: z.string().optional() })
    .openapi("ArchiveOrgMemoryRequest");
  const archiveOrgMemoryResponseSchema = z
    .object({})
    .passthrough()
    .openapi("ArchiveOrgMemoryResponse");
  const pinOrgMemorySchema = z.object({ bullet: z.string() }).openapi("PinOrgMemoryRequest");
  const unpinOrgMemorySchema = z.object({ bullet: z.string() }).openapi("UnpinOrgMemoryRequest");

  function resolveOrgId(c: { req: { param: (n: string) => string } }, authOrgId: string): string {
    const orgId = decodeURIComponent(c.req.param("orgId"));
    if (authOrgId !== orgId) {
      throw new NakamaApiError("Not found", 404);
    }
    return orgId;
  }

  function requireService() {
    if (!orgMemoryService) {
      throw new NakamaApiError("Org memory service not configured", 500);
    }
    return orgMemoryService;
  }

  // GET /v1/orgs/{orgId}/memory — admin + member
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "get",
      path: "/v1/orgs/{orgId}/memory",
      tags: ["Organizations"],
      summary: "Get live org memory",
      operationId: "getOrgMemory",
      request: { params: orgIdParam },
      responses: {
        200: {
          description: "Live org memory",
          content: { "application/json": { schema: orgMemoryResponseSchema } },
        },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.get("/v1/orgs/:orgId/memory", async (c) => {
    const auth = requireNotViewerFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const content = await service.getMemory(orgId);
    return json<OrgMemoryResponse>({ content });
  });

  // PUT /v1/orgs/{orgId}/memory — admin only
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "put",
      path: "/v1/orgs/{orgId}/memory",
      tags: ["Organizations"],
      summary: "Replace live org memory content",
      operationId: "updateOrgMemory",
      request: {
        params: orgIdParam,
        body: {
          required: true,
          content: { "application/json": { schema: updateOrgMemorySchema } },
        },
      },
      responses: {
        200: {
          description: "Memory updated",
          content: { "application/json": { schema: orgMemoryResponseSchema } },
        },
        400: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.put("/v1/orgs/:orgId/memory", async (c) => {
    const auth = requireOrgAdminFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const body = await readJson<UpdateOrgMemoryRequest>(c.req.raw);
    await service.setMemory(orgId, body.content);
    const content = await service.getMemory(orgId);
    return json<OrgMemoryResponse>({ content });
  });

  // POST /v1/orgs/{orgId}/memory/facts — admin only
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgId}/memory/facts",
      tags: ["Organizations"],
      summary: "Add an org memory fact (admin direct, bypass queue)",
      operationId: "addOrgMemoryFact",
      request: {
        params: orgIdParam,
        body: {
          required: true,
          content: { "application/json": { schema: addOrgMemoryFactSchema } },
        },
      },
      responses: {
        200: {
          description: "Fact added",
          content: { "application/json": { schema: orgMemoryResponseSchema } },
        },
        400: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.post("/v1/orgs/:orgId/memory/facts", async (c) => {
    const auth = requireOrgAdminFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const body = await readJson<AddOrgMemoryFactRequest>(c.req.raw);
    await service.addFact(orgId, body.bullet, { pin: body.pin ?? true });
    const content = await service.getMemory(orgId);
    return json<OrgMemoryResponse>({ content });
  });

  // POST /v1/orgs/{orgId}/memory/search — admin + member
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgId}/memory/search",
      tags: ["Organizations"],
      summary: "Search org memory (live + archive)",
      operationId: "searchOrgMemory",
      request: {
        params: orgIdParam,
        body: {
          required: true,
          content: { "application/json": { schema: orgMemorySearchSchema } },
        },
      },
      responses: {
        200: {
          description: "Search results",
          content: { "application/json": { schema: orgMemorySearchResponseSchema } },
        },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.post("/v1/orgs/:orgId/memory/search", async (c) => {
    const auth = requireNotViewerFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const body = await readJson<OrgMemorySearchRequest>(c.req.raw);
    const result = await service.search(orgId, body.query);
    return json<OrgMemorySearchResponse>(result);
  });

  // POST /v1/orgs/{orgId}/memory/pin — admin only
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgId}/memory/pin",
      tags: ["Organizations"],
      summary: "Pin an org memory bullet",
      operationId: "pinOrgMemoryFact",
      request: {
        params: orgIdParam,
        body: { required: true, content: { "application/json": { schema: pinOrgMemorySchema } } },
      },
      responses: {
        200: {
          description: "Pinned",
          content: { "application/json": { schema: orgMemoryResponseSchema } },
        },
        400: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.post("/v1/orgs/:orgId/memory/pin", async (c) => {
    const auth = requireOrgAdminFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const body = await readJson<PinOrgMemoryRequest>(c.req.raw);
    await service.pinFact(orgId, body.bullet);
    const content = await service.getMemory(orgId);
    return json<OrgMemoryResponse>({ content });
  });

  // POST /v1/orgs/{orgId}/memory/unpin — admin only
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgId}/memory/unpin",
      tags: ["Organizations"],
      summary: "Unpin an org memory bullet",
      operationId: "unpinOrgMemoryFact",
      request: {
        params: orgIdParam,
        body: { required: true, content: { "application/json": { schema: unpinOrgMemorySchema } } },
      },
      responses: {
        200: {
          description: "Unpinned",
          content: { "application/json": { schema: orgMemoryResponseSchema } },
        },
        400: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.post("/v1/orgs/:orgId/memory/unpin", async (c) => {
    const auth = requireOrgAdminFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const body = await readJson<UnpinOrgMemoryRequest>(c.req.raw);
    await service.unpinFact(orgId, body.bullet);
    const content = await service.getMemory(orgId);
    return json<OrgMemoryResponse>({ content });
  });

  // POST /v1/orgs/{orgId}/memory/archive — admin only
  app.openAPIRegistry.registerPath(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgId}/memory/archive",
      tags: ["Organizations"],
      summary: "Archive org memory bullets",
      operationId: "archiveOrgMemory",
      request: {
        params: orgIdParam,
        body: {
          required: true,
          content: { "application/json": { schema: archiveOrgMemorySchema } },
        },
      },
      responses: {
        200: {
          description: "Archived",
          content: { "application/json": { schema: archiveOrgMemoryResponseSchema } },
        },
        400: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        403: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        404: { description: "Error", content: { "application/json": { schema: errorSchema } } },
        500: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    }),
  );

  app.post("/v1/orgs/:orgId/memory/archive", async (c) => {
    const auth = requireOrgAdminFromContext(c);
    const orgId = resolveOrgId(c, auth.activeOrgId ?? "");
    const service = requireService();
    const body = await readJson<ArchiveOrgMemoryRequest>(c.req.raw);
    const result = await service.archiveEntries(orgId, body.entries, { reason: body.reason });
    return json<ArchiveOrgMemoryResponse>(result);
  });
}
