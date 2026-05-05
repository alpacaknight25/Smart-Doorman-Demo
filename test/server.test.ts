import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RealtimeController } from "../src/openai-realtime.js";
import { buildServer } from "../src/server.js";
import type { Notifier, VisitorRecord, VisitorStore } from "../src/types.js";
import { VisitorService } from "../src/visitor-service.js";

class NoopStore implements VisitorStore {
  async append(_visitor: VisitorRecord) {}
}

class NoopNotifier implements Notifier {
  async notifyVisitor(_visitor: VisitorRecord) {}
}

describe("server", () => {
  it("accepts incoming OpenAI realtime call webhooks", async () => {
    const acceptedCalls: string[] = [];
    const sidebandCalls: Array<{ callId: string; startedAt: number }> = [];
    const realtime: RealtimeController = {
      unwrapWebhook: async () => ({
        type: "realtime.call.incoming",
        data: { call_id: "rtc_test" },
      }),
      acceptCall: async (callId) => {
        acceptedCalls.push(callId);
      },
      connectSideband: (callId, startedAt) => {
        sidebandCalls.push({ callId, startedAt });
      },
    };
    const app = await buildServer({
      realtime,
      visitorService: new VisitorService(new NoopStore(), new NoopNotifier()),
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/openai",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ type: "realtime.call.incoming", data: { call_id: "rtc_test" } }),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(acceptedCalls, ["rtc_test"]);
    assert.equal(sidebandCalls.length, 1);
    assert.equal(sidebandCalls[0]?.callId, "rtc_test");
    assert.equal(typeof sidebandCalls[0]?.startedAt, "number");
  });

  it("offers a health check", async () => {
    const realtime: RealtimeController = {
      unwrapWebhook: async () => ({}),
      acceptCall: async () => {},
      connectSideband: () => {},
    };
    const app = await buildServer({
      realtime,
      visitorService: new VisitorService(new NoopStore(), new NoopNotifier()),
    });

    const response = await app.inject({ method: "GET", url: "/healthz" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  });
});
