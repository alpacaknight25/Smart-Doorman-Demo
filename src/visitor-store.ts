import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { VisitorRecord, VisitorStore } from "./types.js";

export class JsonlVisitorStore implements VisitorStore {
  constructor(private readonly filePath = "data/visitors.jsonl") {}

  async append(visitor: VisitorRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(visitor)}\n`, "utf8");
  }
}
