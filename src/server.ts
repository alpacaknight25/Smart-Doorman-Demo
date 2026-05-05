import fastify, { type FastifyInstance } from "fastify";
import type { RealtimeController } from "./openai-realtime.js";
import type { VisitorService } from "./visitor-service.js";

export type ServerDeps = {
  realtime: RealtimeController;
  visitorService: VisitorService;
  enableDevRoutes?: boolean;
};

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    try {
      const rawBody = body.toString();
      done(null, {
        rawBody,
        parsedBody: rawBody ? JSON.parse(rawBody) : {},
      });
    } catch (error) {
      done(error as Error);
    }
  });

  app.get("/healthz", async () => ({ ok: true }));

  app.post("/webhooks/openai", async (request, reply) => {
    const body = request.body as { rawBody?: string; parsedBody?: unknown } | undefined;
    const raw = body?.rawBody ?? JSON.stringify(request.body ?? {});
    let event: unknown;

    try {
      event = await deps.realtime.unwrapWebhook(raw, request.headers);
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
      app.log.warn(error, "OpenAI webhook verification failed; using parsed body fallback in development");
      event = body?.parsedBody ?? request.body;
    }

    app.log.info({ eventType: getEventType(event) }, "received OpenAI webhook event");

    if (isIncomingCallEvent(event)) {
      const callStartedAt = Date.now();
      await deps.realtime.acceptCall(event.data.call_id);
      deps.realtime.connectSideband(event.data.call_id, callStartedAt);
    } else {
      app.log.info({ event }, "ignored OpenAI webhook event");
    }

    return reply.code(200).send({ ok: true });
  });

  if (deps.enableDevRoutes) {
    app.post("/dev/wecom-test", async (request) => {
      const payload = request.body;
      const parsedBody = isRecord(payload) ? payload.parsedBody : undefined;
      const body = isRecord(parsedBody) ? parsedBody : isRecord(payload) ? payload : {};
      return deps.visitorService.submitVisitor(
        {
          plate: body.plate ?? "\u6caaA12345",
          company: body.company ?? "\u84dd\u8272\u9cb8\u9c7c\u79d1\u6280",
          phone: body.phone ?? "13800001234",
          reason: body.reason ?? "\u9001\u8d27",
        },
        "dev_manual_test",
        Date.now() - 12_000,
      );
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : "unknown_error";
    return reply.code(statusCode).send({
      ok: false,
      error: statusCode >= 500 ? "internal_error" : message,
    });
  });

  return app;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getEventType(event: unknown): string {
  if (isRecord(event) && typeof event.type === "string") return event.type;
  return "unknown";
}

function isIncomingCallEvent(event: unknown): event is { type: "realtime.call.incoming"; data: { call_id: string } } {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type?: unknown }).type === "realtime.call.incoming" &&
    typeof (event as { data?: { call_id?: unknown } }).data?.call_id === "string"
  );
}
