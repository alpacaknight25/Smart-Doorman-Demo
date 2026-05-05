import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractVisitorFields, mergeVisitorDrafts } from "../src/transcript-extractor.js";

describe("transcript extractor", () => {
  it("extracts visitor fields from one long utterance", () => {
    const draft = extractVisitorFields(
      "\u6caaA12345\uff0c\u6211\u6765\u84dd\u8272\u9cb8\u9c7c\u9001\u8d27\uff0c\u624b\u673a\u53f713800001234",
    );

    assert.deepEqual(draft, {
      plate: "\u6caaA12345",
      company: "\u84dd\u8272\u9cb8\u9c7c",
      phone: "13800001234",
      reason: "\u9001\u8d27",
    });
  });

  it("lets model arguments override transcript fallback values", () => {
    const merged = mergeVisitorDrafts(
      {
        plate: "\u6caaA12345",
        company: "\u84dd\u8272\u9cb8\u9c7c",
        phone: "13800001234",
        reason: "\u9001\u8d27",
      },
      {
        company: "\u84dd\u8272\u9cb8\u9c7c\u79d1\u6280",
      },
    );

    assert.equal(merged.company, "\u84dd\u8272\u9cb8\u9c7c\u79d1\u6280");
  });
});
