import { z } from "zod";

const platePattern =
  /^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}$|^[A-Z]{1,3}[ -]?[A-Z0-9]{4,8}$/i;

export const VisitorInputSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(5, "车牌号太短")
    .max(12, "车牌号太长")
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .refine((value) => platePattern.test(value), "车牌号格式不正确"),
  company: z.string().trim().min(2, "来访单位不能为空").max(60, "来访单位太长"),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^\d]/g, ""))
    .refine((value) => /^1[3-9]\d{9}$/.test(value), "手机号格式不正确"),
  reason: z.string().trim().min(2, "来访事由不能为空").max(80, "来访事由太长"),
});

export function missingVisitorFields(value: unknown): string[] {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return ["plate", "company", "phone", "reason"].filter((field) => {
    const fieldValue = data[field];
    return typeof fieldValue !== "string" || fieldValue.trim().length === 0;
  });
}
