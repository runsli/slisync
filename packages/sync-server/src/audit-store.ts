import type { AuditEntry, AuditSource } from "@slisync/sync-schema";
import {
  createAuditPersistence,
  newAuditId,
  type AuditPersistence,
} from "./audit-persistence";

export type RecordAuditInput = {
  roomId: string;
  actorId: string;
  source: AuditSource;
  action: string;
  summary: string;
  version?: number;
};

export class AuditStore {
  constructor(private readonly persistence: AuditPersistence = createAuditPersistence()) {}

  get backend() {
    return this.persistence.backend;
  }

  async record(input: RecordAuditInput): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: newAuditId(),
      roomId: input.roomId,
      at: Date.now(),
      actorId: input.actorId,
      source: input.source,
      action: input.action,
      summary: input.summary,
      version: input.version,
    };
    await this.persistence.append(entry);
    return entry;
  }

  async list(roomId: string, limit = 50): Promise<AuditEntry[]> {
    return this.persistence.list(roomId, limit);
  }
}
