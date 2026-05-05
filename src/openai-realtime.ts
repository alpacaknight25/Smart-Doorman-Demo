import OpenAI from "openai";
import WebSocket from "ws";
import { AGENT_INSTRUCTIONS, OPENING_LINE, SUBMIT_VISITOR_TOOL } from "./agent-prompt.js";
import { createWebSocketProxyAgent } from "./proxy.js";
import { extractVisitorFields, mergeVisitorDrafts, type VisitorDraft } from "./transcript-extractor.js";
import type { VisitorService } from "./visitor-service.js";

export type IncomingCallEvent = {
  id: string;
  type: "realtime.call.incoming";
  created_at?: number;
  data: {
    call_id: string;
    sip_headers?: Array<{ name: string; value: string }>;
  };
};

export interface RealtimeController {
  unwrapWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<unknown>;
  acceptCall(callId: string): Promise<void>;
  connectSideband(callId: string, callStartedAt: number): void;
}

type RealtimeEvent = Record<string, unknown>;

export class OpenAIRealtimeController implements RealtimeController {
  private readonly client: OpenAI;

  constructor(
    private readonly apiKey: string,
    webhookSecret: string,
    private readonly visitorService: VisitorService,
  ) {
    this.client = new OpenAI({
      apiKey,
      webhookSecret,
    });
  }

  async unwrapWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<unknown> {
    return this.client.webhooks.unwrap(rawBody, headers as Record<string, string>);
  }

  async acceptCall(callId: string): Promise<void> {
    console.info(`[openai] accepting incoming call ${callId}`);
    const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/accept`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "realtime",
        model: "gpt-realtime",
        instructions: AGENT_INSTRUCTIONS,
        tools: [SUBMIT_VISITOR_TOOL],
        tool_choice: "auto",
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI accept call failed: ${response.status} ${await response.text()}`);
    }

    console.info(`[openai] accepted incoming call ${callId}`);
  }

  connectSideband(callId: string, callStartedAt: number): void {
    console.info(`[openai] connecting sideband websocket for ${callId}`);
    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      agent: createWebSocketProxyAgent(),
    });
    const handledToolCalls = new Set<string>();
    let transcriptDraft: VisitorDraft = {};

    ws.on("open", () => {
      console.info(`[openai] sideband websocket open for ${callId}`);
      this.sendJson(ws, {
        type: "session.update",
        session: {
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
              },
            },
          },
        },
      });

      this.sendJson(ws, {
        type: "response.create",
        response: {
          instructions: `\u8bf7\u7528\u4e00\u53e5\u4e2d\u6587\u5f00\u573a\uff1a${OPENING_LINE}`,
        },
      });
    });

    ws.on("message", (data) => {
      void this.handleRealtimeEvent(ws, callId, callStartedAt, handledToolCalls, data.toString(), () => transcriptDraft, (draft) => {
        transcriptDraft = draft;
      }).catch((error) => {
        console.error("Realtime sideband event failed", error);
      });
    });

    ws.on("error", (error) => {
      console.error("Realtime sideband websocket error", error);
    });

    ws.on("close", (code, reason) => {
      console.info(`[openai] sideband websocket closed for ${callId}: ${code} ${reason.toString()}`);
    });
  }

  private async handleRealtimeEvent(
    ws: WebSocket,
    callId: string,
    callStartedAt: number,
    handledToolCalls: Set<string>,
    rawMessage: string,
    getTranscriptDraft: () => VisitorDraft,
    setTranscriptDraft: (draft: VisitorDraft) => void,
  ): Promise<void> {
    const event = JSON.parse(rawMessage) as RealtimeEvent;

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = typeof event.transcript === "string" ? event.transcript : "";
      const extracted = extractVisitorFields(transcript);
      const draft = mergeVisitorDrafts(getTranscriptDraft(), extracted);
      setTranscriptDraft(draft);
      console.info("[openai] transcript fallback updated", { transcript, extracted, draft });
      return;
    }

    if (event.type === "response.function_call_arguments.done" && event.name === "submit_visitor") {
      await this.handleSubmitVisitorTool(
        ws,
        callId,
        callStartedAt,
        handledToolCalls,
        String(event.call_id),
        String(event.arguments ?? "{}"),
        getTranscriptDraft(),
      );
      return;
    }

    if (event.type === "response.done") {
      const output = (event.response as { output?: Array<Record<string, unknown>> } | undefined)?.output ?? [];
      for (const item of output) {
        if (item.type === "function_call" && item.name === "submit_visitor") {
          await this.handleSubmitVisitorTool(
            ws,
            callId,
            callStartedAt,
            handledToolCalls,
            String(item.call_id),
            String(item.arguments ?? "{}"),
            getTranscriptDraft(),
          );
        }
      }
    }
  }

  private async handleSubmitVisitorTool(
    ws: WebSocket,
    callId: string,
    callStartedAt: number,
    handledToolCalls: Set<string>,
    toolCallId: string,
    rawArguments: string,
    transcriptDraft: VisitorDraft,
  ): Promise<void> {
    if (handledToolCalls.has(toolCallId)) return;
    handledToolCalls.add(toolCallId);

    console.info("[openai] submit_visitor tool called", {
      callId,
      toolCallId,
      rawArguments,
    });

    let modelArgs: unknown;
    try {
      modelArgs = JSON.parse(rawArguments);
    } catch {
      modelArgs = {};
    }

    const mergedArgs = mergeVisitorDrafts(transcriptDraft, modelArgs);
    console.info("[openai] merged submit_visitor arguments", {
      transcriptDraft,
      modelArgs,
      mergedArgs,
    });

    const result = await this.visitorService.submitVisitor(mergedArgs, callId, callStartedAt);

    this.sendJson(ws, {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: toolCallId,
        output: JSON.stringify(result),
      },
    });

    this.sendJson(ws, {
      type: "response.create",
      response: {
        instructions: result.ok
          ? "\u7528\u4e00\u53e5\u8bdd\u8bf4\uff1a\u597d\u7684\uff0c\u5df2\u901a\u77e5\u95e8\u536b\uff0c\u8bf7\u7a0d\u7b49\u653e\u884c\u3002\u4e0d\u8981\u518d\u8be2\u95ee\u3002"
          : `\u53ea\u8ffd\u95ee\u8fd9\u4e9b\u95ee\u9898\uff1a${result.message}`,
      },
    });
  }

  private sendJson(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}
