import type { Notifier, VisitorRecord } from "./types.js";

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "未知";
  return `${Math.round(ms / 1000)}s`;
}

export function renderWeComMarkdown(visitor: VisitorRecord, mentionMobiles: string[] = []): string {
  const mentionText = mentionMobiles.length > 0 ? `\n<@${mentionMobiles.join(">, <@")}>` : "";

  return [
    "## 新访客车辆登记",
    `> 车牌号：<font color=\"warning\">${visitor.plate}</font>`,
    `> 来访单位：${visitor.company}`,
    `> 来访事由：${visitor.reason}`,
    `> 手机号：${visitor.phone}`,
    `> 入场时间：${visitor.entryTime}`,
    `> 通话耗时：${formatDuration(visitor.durationMs)}`,
    "",
    "请确认后远程放行。",
    mentionText,
  ]
    .filter(Boolean)
    .join("\n");
}

export class WeComNotifier implements Notifier {
  constructor(
    private readonly webhookUrl: string,
    private readonly mentionMobiles: string[] = [],
  ) {}

  async notifyVisitor(visitor: VisitorRecord): Promise<void> {
    console.info("[wecom] sending visitor notification", {
      plate: visitor.plate,
      webhookHost: new URL(this.webhookUrl).host,
    });
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: {
          content: renderWeComMarkdown(visitor, this.mentionMobiles),
        },
      }),
    });

    const body = await response.text();
    console.info("[wecom] webhook response", {
      status: response.status,
      body,
    });
    if (!response.ok) {
      throw new Error(`WeCom webhook failed: ${response.status} ${body}`);
    }

    try {
      const payload = JSON.parse(body) as { errcode?: number; errmsg?: string };
      if (payload.errcode && payload.errcode !== 0) {
        throw new Error(`WeCom webhook rejected message: ${payload.errcode} ${payload.errmsg ?? ""}`.trim());
      }
    } catch (error) {
      if (error instanceof SyntaxError) return;
      throw error;
    }
  }
}
