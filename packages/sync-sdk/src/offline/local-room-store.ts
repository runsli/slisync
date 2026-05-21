/** Client-side room persistence abstraction (`createIndexedDBRoomStore` or noop). */

import {
  isRoomLocalRecord,
  ROOM_LOCAL_SCHEMA_VERSION,
  type RoomLocalRecord,
} from "./room-record";

export interface LocalRoomStore {
  get(roomId: string): Promise<RoomLocalRecord | null>;
  put(record: RoomLocalRecord): Promise<void>;
  delete(roomId: string): Promise<void>;
  listRoomIds(): Promise<string[]>;
}

/** True when the runtime exposes the IndexedDB API (browser; not Node SSR). */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** In-memory store for tests and `localPersistence: false`. */
export function createNoopLocalRoomStore(): LocalRoomStore {
  const records = new Map<string, RoomLocalRecord>();

  return {
    async get(roomId) {
      const record = records.get(roomId);
      if (!record) return null;
      if (!isRoomLocalRecord(record)) {
        records.delete(roomId);
        return null;
      }
      return record;
    },

    async put(record) {
      if (!isRoomLocalRecord(record)) {
        throw new Error("Invalid RoomLocalRecord");
      }
      records.set(record.roomId, {
        ...record,
        schemaVersion: ROOM_LOCAL_SCHEMA_VERSION,
        updatedAt: record.updatedAt ?? Date.now(),
      });
    },

    async delete(roomId) {
      records.delete(roomId);
    },

    async listRoomIds() {
      return [...records.keys()];
    },
  };
}
