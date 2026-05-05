import type { Notifier, ToolResult, VisitorInput, VisitorRecord, VisitorStore } from "./types.js";
import { VisitorInputSchema, missingVisitorFields } from "./validation.js";

export class VisitorService {
  constructor(
    private readonly store: VisitorStore,
    private readonly notifier: Notifier,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async submitVisitor(input: unknown, callId: string, callStartedAt: number): Promise<ToolResult> {
    const missingFields = missingVisitorFields(input);
    if (missingFields.length > 0) {
      return {
        ok: false,
        message: `还缺这些信息：${missingFields.join(", ")}`,
        missingFields,
      };
    }

    const parsed = VisitorInputSchema.safeParse(input);
    if (!parsed.success) {
      console.warn("[visitor] rejected invalid visitor input", {
        input,
        errors: parsed.error.issues.map((issue) => issue.message),
      });
      return {
        ok: false,
        message: "访客信息格式需要再确认",
        errors: parsed.error.issues.map((issue) => issue.message),
      };
    }

    const visitor = this.toRecord(parsed.data, callId, callStartedAt);
    console.info("[visitor] storing visitor record", {
      callId: visitor.callId,
      plate: visitor.plate,
      company: visitor.company,
      reason: visitor.reason,
    });
    await this.store.append(visitor);
    await this.notifier.notifyVisitor(visitor);
    console.info("[visitor] notified guard", {
      callId: visitor.callId,
      plate: visitor.plate,
    });

    return {
      ok: true,
      message: "已通知门卫，请稍等放行。",
      visitor,
    };
  }

  private toRecord(input: VisitorInput, callId: string, callStartedAt: number): VisitorRecord {
    const now = this.now();
    return {
      ...input,
      callId,
      entryTime: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now),
      durationMs: Math.max(0, now.getTime() - callStartedAt),
    };
  }
}
