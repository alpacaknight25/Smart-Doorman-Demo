import type { VisitorInput } from "./types.js";
import { VisitorInputSchema } from "./validation.js";

export type VisitorDraft = Partial<VisitorInput>;

const reasonKeywords = [
  "\u9001\u8d27",
  "\u9762\u8bd5",
  "\u62dc\u8bbf",
  "\u7ef4\u4fee",
  "\u65bd\u5de5",
  "\u5f00\u4f1a",
  "\u53c2\u89c2",
  "\u53d6\u8d27",
  "\u9001\u6587\u4ef6",
];

export function extractVisitorFields(transcript: string): VisitorDraft {
  const text = normalizeTranscript(transcript);
  const plate = text.match(/[\u4e00-\u9fa5][A-Za-z][A-Za-z0-9]{5,6}/)?.[0]?.toUpperCase();
  const phone = text.match(/1[3-9]\d{9}/)?.[0];
  const reason = reasonKeywords.find((keyword) => text.includes(keyword));
  const company = extractCompany(text);

  return removeEmpty({ plate, company, phone, reason });
}

export function mergeVisitorDrafts(...drafts: Array<unknown>): VisitorDraft {
  const merged: VisitorDraft = {};

  for (const draft of drafts) {
    if (!isRecord(draft)) continue;
    for (const field of ["plate", "company", "phone", "reason"] as const) {
      const value = draft[field];
      if (typeof value === "string" && value.trim().length > 0) {
        merged[field] = value.trim();
      }
    }
  }

  return merged;
}

export function isCompleteVisitorDraft(draft: VisitorDraft): draft is VisitorInput {
  return VisitorInputSchema.safeParse(draft).success;
}

function normalizeTranscript(transcript: string): string {
  return transcript
    .replace(/\s+/g, "")
    .replace(/[，。；;,.]/g, "\uff0c")
    .replace(/\u84dd\u9cb8/g, "\u84dd\u8272\u9cb8\u9c7c");
}

function extractCompany(text: string): string | undefined {
  const explicit = text.match(/(?:\u627e|\u53bb|\u5230|\u6765)([^，。,.]{2,24}?(?:\u516c\u53f8|\u79d1\u6280|\u96c6\u56e2|\u56ed\u533a))/)?.[1];
  if (explicit) return cleanupCompany(explicit);

  if (text.includes("\u84dd\u8272\u9cb8\u9c7c")) {
    return text.includes("\u84dd\u8272\u9cb8\u9c7c\u79d1\u6280") ? "\u84dd\u8272\u9cb8\u9c7c\u79d1\u6280" : "\u84dd\u8272\u9cb8\u9c7c";
  }

  const beforeReason = text.match(
    /(?:\u627e|\u53bb|\u5230|\u6765)([^，。,.]{2,16}?)(?:\u9001\u8d27|\u9762\u8bd5|\u62dc\u8bbf|\u7ef4\u4fee|\u65bd\u5de5|\u5f00\u4f1a|\u53c2\u89c2|\u53d6\u8d27)/,
  )?.[1];
  return beforeReason ? cleanupCompany(beforeReason) : undefined;
}

function cleanupCompany(company: string): string {
  return company.replace(/^(\u4e00\u4e0b|\u8fd9\u8fb9|\u4eca\u5929|\u8fd8\u662f)/, "").replace(/\u7684$/, "");
}

function removeEmpty(draft: VisitorDraft): VisitorDraft {
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => value)) as VisitorDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
