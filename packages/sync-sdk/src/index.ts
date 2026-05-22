/** Client-safe SDK entry (no Node.js / ioredis dependencies). */

export { SYNC_EVENTS } from "./protocol";
export type {
  GraphActivityPayload,
  GraphActivitySource,
  GraphNotifyPayload,
  AgentActivityPayload,
  AgentMemoryEntry,
  AgentMemoryPatch,
  AgentPushAck,
  AgentPushPayload,
  ConflictReason,
  ConnectionStatus,
  PatchOptions,
  SyncConflictPayload,
  SyncCrdtJoinPayload,
  SyncCrdtUpdatePayload,
  SyncJoinPayload,
  SyncPatchBroadcast,
  SyncPatchPayload,
  SyncStatePayload,
  SyncStrategy,
  SyncUpdatePayload,
} from "./protocol";

export { diffState, applyStatePatch, tryApplyStatePatch } from "./patch";
export type { Operation } from "./patch";

export {
  createSyncStore,
  type SyncConflict,
  type SyncStore,
  type SyncStoreHook,
} from "./store/create-sync-store";

export {
  SyncClient,
  createSyncClient,
  type SyncClientOptions,
} from "./client/create-sync-client";

export {
  CrdtSyncClient,
  createCrdtSyncClient,
  type CrdtSyncClientOptions,
} from "./client/create-crdt-sync-client";

export type { SharedMemoryState } from "./shared-memory-state";
export { pushAgentMemory, applyAgentMemoryToState } from "./agent";
export {
  MemoryGraph,
  traverseGraph,
  initMemoryGraphDoc,
  buildScopedMemoryOps,
  buildDemoTaskOps,
  filterNodesByScope,
  filterTasksByScope,
  exportMemoryChunksFromSnapshot,
  exportMemoryChunksFromCrdtUpdate,
  exportMemoryChunksFromCrdtFile,
  slugifyChunkFilename,
} from "./graph";
export type { UpsertTaskInput, UpdateTaskPatch } from "./graph";
export type { ExportChunksOptions, ExportedChunkFile } from "./graph";
export type {
  GraphMeta,
  MemoryGraphSnapshot,
  MemoryNode,
  MemoryEdge,
  TraverseQuery,
  TraverseResult,
  UpsertNodeInput,
  LinkOptions,
  EdgeRelation,
  MemoryNodeKind,
} from "@slisync/sync-schema";
export { encodeUpdate, decodeUpdate } from "./crdt/codec";
export { getSyncEndpoint } from "./get-sync-endpoint";
export { getRoomSyncToken, getAgentSyncToken } from "./get-sync-auth";
export {
  defaultProtocolVersion,
  withSyncProtocolHeaders,
  SYNC_PROTOCOL_VERSION,
} from "./sync-protocol-client";
export {
  SYNC_PROTOCOL_MIN_VERSION,
  SYNC_PROTOCOL_MAX_VERSION,
  SYNC_PROTOCOL_HEADER,
  negotiateProtocolVersion,
  parseProtocolVersion,
} from "@slisync/sync-schema";
export { getSyncHttpBase } from "./get-sync-http-base";
export { pushGraphOpsHttp, type PushGraphOpsHttpResult } from "./graph/push-graph-ops-http";
export {
  fetchGraphTraverseHttp,
  type FetchGraphTraverseHttpOptions,
  type FetchGraphTraverseHttpResult,
} from "./graph/fetch-graph-traverse-http";
export {
  fetchExportChunksHttp,
  buildExportChunksHttpUrl,
  appendExportChunksQuery,
  type FetchExportChunksHttpOptions,
  type FetchExportChunksHttpResult,
} from "./graph/fetch-export-chunks-http";
export {
  validateGraphOps,
  DEFAULT_AGENT_GRAPH_POLICY,
  type AgentGraphPolicy,
} from "@slisync/sync-schema";

export {
  CrdtUpdateOutbox,
  InMemoryCrdtOutbox,
} from "./offline/crdt-outbox";
export { createCrdtOutbox, type CreateCrdtOutboxOptions } from "./offline/create-crdt-outbox";
export {
  PersistentCrdtOutbox,
  type PersistentCrdtOutboxOptions,
} from "./offline/persistent-crdt-outbox";
export {
  ROOM_LOCAL_SCHEMA_VERSION,
  createEmptyRoomLocalRecord,
  isRoomLocalRecord,
  type RoomLocalRecord,
  type RoomLocalStrategy,
} from "./offline/room-record";
export {
  createNoopLocalRoomStore,
  isIndexedDBAvailable,
  type LocalRoomStore,
} from "./offline/local-room-store";
export {
  createIndexedDBRoomStore,
  LocalRoomQuotaExceededError,
} from "./offline/indexeddb-room-store";
export type { CrdtOutbox } from "./offline/crdt-outbox-types";
export { applyServerSnapshotToDoc } from "./offline/merge-local-remote";
export { clearLocalRoom } from "./offline/clear-local-room";
export { resolveLocalRoomStore } from "./offline/resolve-local-room-store";
export { fetchSyncCapabilities, type SyncCapabilities } from "./fetch-sync-capabilities";
export {
  SYNC_STRATEGY_DETAILS,
  strategyFeatureFor,
  type StrategyDetailRow,
} from "./strategy-reference";
export {
  summarizeAgentGraphPolicy,
  ALL_AGENT_GRAPH_OPS,
  ALL_MEMORY_NODE_KINDS,
  ALL_EDGE_RELATIONS,
  type AgentGraphPolicySummary,
} from "@slisync/sync-schema";
export { useSync, type UseSyncOptions } from "./hooks/use-sync";
export { useMemoryGraph, type UseMemoryGraphOptions } from "./hooks/use-memory-graph";
