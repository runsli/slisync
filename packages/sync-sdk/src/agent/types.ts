import type { GraphOp } from "@slisync/sync-schema";

/** Structured agent write to shared memory. */

export type AgentMemoryEntry = {
  agentId: string;
  action: string;
  summary: string;
  at: number;
};

export type AgentMemoryPatch = {
  /** Replace message entirely. */
  message?: string;
  /** Append suffix to current message (e.g. agent annotation). */
  appendToMessage?: string;
  /** Add to shared counter. */
  counterDelta?: number;
};

export type AgentPushPayload = {
  roomId: string;
  agentId: string;
  action: string;
  /** Wire protocol version (defaults to 1 if omitted). */
  protocolVersion?: number;
  /** Agent or room token when server auth is enabled. */
  token?: string;
  /** Legacy demo fields (optional when graphOps present). */
  memory?: AgentMemoryPatch;
  /** Batch graph mutations applied to room CRDT doc. */
  graphOps?: GraphOp[];
};

export type AgentPushAck = {
  ok: boolean;
  version?: number;
  entry?: AgentMemoryEntry;
  error?: string;
};

export type AgentActivityPayload = {
  roomId: string;
  entry: AgentMemoryEntry;
  version: number;
};
