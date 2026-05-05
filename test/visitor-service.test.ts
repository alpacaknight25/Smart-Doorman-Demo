import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Notifier, VisitorRecord, VisitorStore } from "../src/types.js";
import { VisitorService } from "../src/visitor-service.js";

class MemoryStore implements VisitorStore {
  records: VisitorRecord[] = [];
  async append(visitor: VisitorRecord) {
    this.records.push(visitor);
  }
}

class MemoryNotifier implements Notifier {
  records: VisitorRecord[] = [];
  async notifyVisitor(visitor: VisitorRecord) {
    this.records.push(visitor);
  }
}

describe("VisitorService", () => {
  it("rejects incomplete tool arguments", async () => {
    const service = new VisitorService(new MemoryStore(), new MemoryNotifier());

    const result = await service.submitVisitor({ plate: "沪A12345" }, "rtc_test", Date.now());

    assert.equal(result.ok, false);
    assert.deepEqual(result.missingFields, ["company", "phone", "reason"]);
  });

  it("stores and notifies complete visitor records", async () => {
    const store = new MemoryStore();
    const notifier = new MemoryNotifier();
    const now = () => new Date("2026-05-02T06:30:15.000Z");
    const service = new VisitorService(store, notifier, now);

    const result = await service.submitVisitor(
      {
        plate: "沪A12345",
        company: "蓝色鲸鱼科技",
        phone: "13800001234",
        reason: "送货",
      },
      "rtc_test",
      new Date("2026-05-02T06:30:00.000Z").getTime(),
    );

    assert.equal(result.ok, true);
    assert.equal(store.records.length, 1);
    assert.equal(notifier.records.length, 1);
    assert.deepEqual(
      {
        plate: store.records[0]?.plate,
        company: store.records[0]?.company,
        durationMs: store.records[0]?.durationMs,
        callId: store.records[0]?.callId,
      },
      {
      plate: "沪A12345",
      company: "蓝色鲸鱼科技",
      durationMs: 15_000,
      callId: "rtc_test",
      },
    );
  });
});
