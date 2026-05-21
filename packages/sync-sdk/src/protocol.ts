/** Shared wire protocol between client and server (SDK boundary). */

import type { Operation } from "./patch";

export {
  SYNC_PROTOCOL_VERSION,
  SYNC_PROTOCOL_MIN_VERSION,
  SYNC_PROTOCOL_MAX_VERSION,
  SYNC_PROTOCOL_HEADER,
  negotiateProtocolVersion,
  parseProtocolVersion,
} from "@slisync/sync-schema";

export const SYNC_EVENTS = {
  JOIN: "sync:join",
  /** Full state replace (fallback / join snapshot). */
  UPDATE: "sync:update",
  /** Incremental RFC 6902 patch (LWW primary transport). */
  PATCH: "sync:patch",
  STATE: "sync:state",
  REQUEST_STATE: "sync:request-state",
  /** Server rejected a write (LWW optimistic concurrency). */
  CONFLICT: "sync:conflict",
  /** Yjs CRDT join. */
  CRDT_JOIN: "sync:crdt-join",
  /** Yjs incremental update (base64). */
  CRDT_UPDATE: "sync:crdt-update",
  /** Full Yjs snapshot on join (base64). */
  CRDT_SYNC: "sync:crdt-sync",
  /** Agent pushes memory into a room (server-authoritative). */
  AGENT_PUSH: "sync:agent-push",
  /** Broadcast after an agent write (toast / log UI). */
  AGENT_ACTIVITY: "sync:agent-activity",
  /** Graph change broadcast (agent push or relayed human notify). */
  GRAPH_ACTIVITY: "sync:graph-activity",
  /** Client → server: request relay of graph activity to room. */
  GRAPH_NOTIFY: "sync:graph-notify",
  /** Auth / policy rejection or fatal sync error. */
  ERROR: "sync:error",
  /** Announce client presence in room (after CRDT join). */
  PRESENCE_JOIN: "sync:presence-join",
  PRESENCE_UPDATE: "sync:presence-update",
  PRESENCE_LEAVE: "sync:presence-leave",
  PRESENCE_STATE: "sync:presence-state",
} as const;

export type {
  GraphActivityPayload,
  GraphActivitySource,
  GraphNotifyPayload,
  PresenceJoinPayload,
  PresenceMember,
  PresenceStatePayload,
  PresenceStatus,
  PresenceUpdatePayload,
} from "@slisync/sync-schema";

export type { SyncAuthErrorCode, SyncErrorPayload } from "@slisync/sync-schema";

export type {
  AgentActivityPayload,
  AgentMemoryEntry,
  AgentMemoryPatch,
  AgentPushAck,
  AgentPushPayload,
} from "./agent/types";

export interface SyncCrdtSyncPayload {
  roomId: string;
  /** Base64-encoded Yjs snapshot. */
  update: string;
}

export interface SyncCrdtJoinAck {
  update?: string;
  error?: string;
  code?: import("@slisync/sync-schema").SyncAuthErrorCode;
  protocolVersion?: number;
}

export type SyncStrategy = "lww" | "crdt";

export type SyncEvent = (typeof SYNC_EVENTS)[keyof typeof SYNC_EVENTS];

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export type ConflictReason = "stale_version" | "invalid_patch";

export interface SyncConflictPayload<T = unknown> {
  reason: ConflictReason;
  version: number;
  state: T;
}

export interface SyncStatePayload<T = unknown> {
  state: T;
  version: number;
}

export interface SyncPatchPayload {
  roomId: string;
  patch: Operation[];
  /** Must match server room version or LWW write is rejected. */
  baseVersion: number;
}

export interface SyncPatchBroadcast {
  patch: Operation[];
  version: number;
}

export interface SyncJoinPayload<T = unknown> {
  roomId: string;
  /** Used only when the room does not exist on the server yet. */
  defaultState?: T;
  /** Required when server auth is enabled. */
  token?: string;
  /** Wire protocol version (defaults to 1 if omitted). */
  protocolVersion?: number;
}

export interface SyncUpdatePayload<T = unknown> {
  roomId: string;
  state: T;
  baseVersion: number;
}

export interface PatchOptions {
  /** Debounce network emit (local state still updates immediately). */
  debounceMs?: number;
}

export interface SyncCrdtJoinPayload<T = unknown> {
  roomId: string;
  defaultState?: T;
  token?: string;
  protocolVersion?: number;
}

export interface SyncCrdtUpdatePayload {
  roomId: string;
  /** Base64-encoded Yjs update. */
  update: string;
}
