/** Durable audit log entries (agent / human / system). */

export type AuditSource = "agent" | "human" | "system";

export interface AuditEntry {
  id: string;
  roomId: string;
  at: number;
  actorId: string;
  source: AuditSource;
  action: string;
  summary: string;
  version?: number;
}
