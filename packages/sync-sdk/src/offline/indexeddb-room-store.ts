/**
 * IndexedDB-backed LocalRoomStore for browser local-first persistence.
 * QuotaExceededError is rethrown as LocalRoomQuotaExceededError for callers to handle.
 */

import { isIndexedDBAvailable } from "./local-room-store";
import type { LocalRoomStore } from "./local-room-store";
import {
  isRoomLocalRecord,
  ROOM_LOCAL_SCHEMA_VERSION,
  type RoomLocalRecord,
} from "./room-record";

const DB_NAME = "slisync";
const DB_VERSION = 1;
const STORE_NAME = "rooms";

/** Thrown when IndexedDB put exceeds storage quota. */
export class LocalRoomQuotaExceededError extends Error {
  readonly name = "LocalRoomQuotaExceededError";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

function isQuotaExceeded(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function wrapIdbError(err: unknown, context: string): Error {
  if (isQuotaExceeded(err)) {
    return new LocalRoomQuotaExceededError(
      `IndexedDB quota exceeded while ${context}`,
      { cause: err },
    );
  }
  if (err instanceof Error) return err;
  return new Error(`${context}: ${String(err)}`);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(wrapIdbError(request.error, "opening database"));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "roomId" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        let result!: T;

        request.onsuccess = () => {
          result = request.result as T;
        };

        request.onerror = () => {
          reject(wrapIdbError(request.error, `${mode} request`));
        };

        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };

        tx.onerror = () => {
          db.close();
          reject(wrapIdbError(tx.error, `${mode} transaction`));
        };

        tx.onabort = () => {
          db.close();
          reject(wrapIdbError(tx.error, `${mode} transaction aborted`));
        };
      }),
  );
}

function normalizeRecord(record: RoomLocalRecord): RoomLocalRecord {
  if (!isRoomLocalRecord(record)) {
    throw new Error("Invalid RoomLocalRecord");
  }
  return {
    ...record,
    schemaVersion: ROOM_LOCAL_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
}

/** Browser LocalRoomStore backed by IndexedDB (`slisync` / `rooms`). */
export function createIndexedDBRoomStore(): LocalRoomStore {
  if (!isIndexedDBAvailable()) {
    throw new Error("IndexedDB is not available in this environment");
  }

  return {
    async get(roomId) {
      const raw = await runTransaction("readonly", (store) =>
        store.get(roomId),
      );
      if (raw === undefined) return null;
      if (!isRoomLocalRecord(raw)) return null;
      return raw;
    },

    async put(record) {
      const normalized = normalizeRecord(record);
      await runTransaction("readwrite", (store) => store.put(normalized));
    },

    async delete(roomId) {
      await runTransaction("readwrite", (store) => store.delete(roomId));
    },

    async listRoomIds() {
      const keys = await runTransaction("readonly", (store) => store.getAllKeys());
      return keys.filter((key): key is string => typeof key === "string");
    },
  };
}
