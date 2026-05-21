export { createSyncHttpServer, type CreateSyncHttpServerOptions } from "./create-sync-http-server";
export {
  loadSyncAuthConfig,
  verifyRoomToken,
  verifyAgentToken,
  type SyncAuthConfig,
} from "./auth";
export { loadAgentGraphPolicy } from "./agent-graph-policy-config";
export { commitAgentWriteToRoom, type CommitAgentWriteDeps } from "./commit-agent-write";
export { createGraphHttpHandler, type GraphHttpPostBody } from "./graph-http";
export {
  parseGraphTraverseRoute,
  parseTraverseQueryParams,
  type GraphHttpTraverseResponse,
} from "./graph-http-traverse";
export { attachGraphNotify } from "./attach-graph-notify";
export {
  attachPresenceServer,
  resetPresenceRegistryForTests,
} from "./attach-presence-server";
export {
  handleSyncCapabilitiesGet,
  defaultCapabilitiesSnapshot,
  type SyncCapabilitiesResponse,
} from "./sync-capabilities-http";
export { attachAgentServer } from "./attach-agent-server";
export type { AttachAgentServerDeps } from "./attach-agent-server";
export { attachCrdtServer } from "./attach-crdt-server";
export { createCrdtRoomStore } from "./crdt-room-store";
export { conflictReasonForPatch, isStaleWrite } from "./conflict";
export { attachSyncServer } from "./attach-sync-server";
export type { AttachSyncServerOptions } from "./attach-sync-server";
export {
  RoomStore,
  createPersistence,
  createRedisPersistence,
  createFilePersistence,
  createMemoryPersistence,
  type RoomPersistence,
  type RoomRecord,
  type PersistenceBackend,
} from "./persistence";
export { getLanIPv4Addresses } from "./network";
export {
  attachSocketRedisAdapter,
  shouldEnableSocketRedisAdapter,
  type SocketRedisAdapterHandle,
} from "./socket-redis-adapter";
export {
  assertSocketProtocol,
  assertHttpProtocol,
  readHttpProtocolVersion,
} from "./protocol-guard";
export { AuditStore, type RecordAuditInput } from "./audit-store";
export { createAuditPersistence, createMemoryAuditPersistence } from "./audit-persistence";
export { createAuditHttpHandler } from "./audit-http";
