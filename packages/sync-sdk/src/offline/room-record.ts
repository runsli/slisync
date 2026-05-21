/** Per-room local persistence record for CRDT local-first (IndexedDB or in-memory). */

export const ROOM_LOCAL_SCHEMA_VERSION = 1 as const;

export type RoomLocalStrategy = "crdt";

/** Serialized room state stored on the client between sessions. */
export type RoomLocalRecord = {
  schemaVersion: typeof ROOM_LOCAL_SCHEMA_VERSION;
  roomId: string;
  strategy: RoomLocalStrategy;
  /** `Y.encodeStateAsUpdate(doc)` encoded as base64. */
  docSnapshot: string;
  /** FIFO queue of base64-encoded incremental CRDT updates not yet acknowledged by the server. */
  outbox: string[];
  clientId: string | null;
  /** Unix ms when the client last completed a successful server sync, or null if never. */
  lastSyncedAt: number | null;
  /** Unix ms when this record was last written locally. */
  updatedAt: number;
};

/** Minimal record used when only the outbox has been persisted so far. */
export function createEmptyRoomLocalRecord(roomId: string): RoomLocalRecord {
  return {
    schemaVersion: ROOM_LOCAL_SCHEMA_VERSION,
    roomId,
    strategy: "crdt",
    docSnapshot: "",
    outbox: [],
    clientId: null,
    lastSyncedAt: null,
    updatedAt: Date.now(),
  };
}

export function isRoomLocalRecord(value: unknown): value is RoomLocalRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as RoomLocalRecord;
  return (
    r.schemaVersion === ROOM_LOCAL_SCHEMA_VERSION &&
    typeof r.roomId === "string" &&
    r.roomId.length > 0 &&
    r.strategy === "crdt" &&
    typeof r.docSnapshot === "string" &&
    Array.isArray(r.outbox) &&
    r.outbox.every((item) => typeof item === "string") &&
    (r.clientId === null || typeof r.clientId === "string") &&
    (r.lastSyncedAt === null || typeof r.lastSyncedAt === "number") &&
    typeof r.updatedAt === "number"
  );
}
