export type VisitorInput = {
  plate: string;
  company: string;
  phone: string;
  reason: string;
};

export type VisitorRecord = VisitorInput & {
  callId: string;
  entryTime: string;
  durationMs: number;
};

export type ToolResult =
  | {
      ok: true;
      message: string;
      visitor: VisitorRecord;
    }
  | {
      ok: false;
      message: string;
      missingFields?: string[];
      errors?: string[];
    };

export interface Notifier {
  notifyVisitor(visitor: VisitorRecord): Promise<void>;
}

export interface VisitorStore {
  append(visitor: VisitorRecord): Promise<void>;
}
