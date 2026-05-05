import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderWeComMarkdown } from "../src/wecom.js";

describe("WeCom markdown", () => {
  it("renders the visitor registration message", () => {
    const markdown = renderWeComMarkdown(
      {
        plate: "沪A12345",
        company: "蓝色鲸鱼科技",
        phone: "13800001234",
        reason: "送货",
        entryTime: "2026/05/02 14:30:00",
        durationMs: 15_200,
        callId: "rtc_test",
      },
      ["13800001234"],
    );

    assert.match(markdown, /新访客车辆登记/);
    assert.match(markdown, /沪A12345/);
    assert.match(markdown, /蓝色鲸鱼科技/);
    assert.match(markdown, /15s/);
    assert.match(markdown, /<@13800001234>/);
  });
});
