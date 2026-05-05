import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VisitorInputSchema, missingVisitorFields } from "../src/validation.js";

describe("visitor validation", () => {
  it("normalizes valid visitor input", () => {
    const parsed = VisitorInputSchema.parse({
      plate: " 沪 a12345 ",
      company: "蓝色鲸鱼科技",
      phone: "138-0000-1234",
      reason: "送货",
    });

    assert.deepEqual(parsed, {
      plate: "沪A12345",
      company: "蓝色鲸鱼科技",
      phone: "13800001234",
      reason: "送货",
    });
  });

  it("reports missing fields before format validation", () => {
    assert.deepEqual(missingVisitorFields({ plate: "沪A12345", phone: "" }), ["company", "phone", "reason"]);
  });

  it("rejects invalid mobile numbers", () => {
    assert.throws(() =>
      VisitorInputSchema.parse({
        plate: "沪A12345",
        company: "蓝色鲸鱼科技",
        phone: "123",
        reason: "送货",
      }),
    );
  });
});
