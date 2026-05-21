import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createIndexedDBRoomStore,
  LocalRoomQuotaExceededError,
  ROOM_LOCAL_SCHEMA_VERSION,
  type RoomLocalRecord,
} from "@slisync/sync-sdk";

function sampleRecord(roomId: string, overrides: Partial<RoomLocalRecord> = {}): RoomLocalRecord {
  return {
    schemaVersion: ROOM_LOCAL_SCHEMA_VERSION,
    roomId,
    strategy: "crdt",
    docSnapshot: "dGVzdA==",
    outbox: [],
    clientId: "client-1",
    lastSyncedAt: null,
    updatedAt: 1,
    ...overrides,
  };
}

async function clearSlisyncDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("slisync");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe("createIndexedDBRoomStore", () => {
  afterEach(async () => {
    await clearSlisyncDb();
  });

  it("put then get via a new store instance returns the same record", async () => {
    const store1 = createIndexedDBRoomStore();
    const record = sampleRecord("room-a", { outbox: ["upd-1"] });
    await store1.put(record);

    const store2 = createIndexedDBRoomStore();
    const loaded = await store2.get("room-a");
    assert.ok(loaded);
    assert.equal(loaded.roomId, "room-a");
    assert.equal(loaded.docSnapshot, record.docSnapshot);
    assert.deepEqual(loaded.outbox, ["upd-1"]);
    assert.equal(loaded.clientId, "client-1");
    assert.ok(loaded.updatedAt >= record.updatedAt);
  });

  it("delete removes the record", async () => {
    const store = createIndexedDBRoomStore();
    await store.put(sampleRecord("room-del"));
    await store.delete("room-del");
    assert.equal(await store.get("room-del"), null);
  });

  it("listRoomIds returns all stored room ids", async () => {
    const store = createIndexedDBRoomStore();
    await store.put(sampleRecord("room-1"));
    await store.put(sampleRecord("room-2"));
    const ids = await store.listRoomIds();
    assert.deepEqual(new Set(ids), new Set(["room-1", "room-2"]));
  });

  it("get returns null for unknown roomId", async () => {
    const store = createIndexedDBRoomStore();
    assert.equal(await store.get("missing"), null);
  });

  it("get returns null when schemaVersion does not match", async () => {
    const store = createIndexedDBRoomStore();
    await runTransactionPut({
      roomId: "stale",
      schemaVersion: 99,
      strategy: "crdt",
      docSnapshot: "",
      outbox: [],
      clientId: null,
      lastSyncedAt: null,
      updatedAt: 1,
    });
    assert.equal(await store.get("stale"), null);
  });

  it("put sets updatedAt automatically", async () => {
    const store = createIndexedDBRoomStore();
    const before = Date.now();
    await store.put(sampleRecord("room-ts", { updatedAt: 0 }));
    const loaded = await store.get("room-ts");
    assert.ok(loaded);
    assert.ok(loaded.updatedAt >= before);
  });
});

/** Direct IDB write to bypass record validation (stale schema test). */
async function runTransactionPut(value: Record<string, unknown>) {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("slisync", 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("rooms")) {
        db.createObjectStore("rooms", { keyPath: "roomId" });
      }
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("rooms", "readwrite");
      tx.objectStore("rooms").put(value);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    open.onerror = () => reject(open.error);
  });
}

describe("LocalRoomQuotaExceededError", () => {
  it("is exported for quota handling", () => {
    const err = new LocalRoomQuotaExceededError("test");
    assert.equal(err.name, "LocalRoomQuotaExceededError");
    assert.ok(err instanceof Error);
  });
});
