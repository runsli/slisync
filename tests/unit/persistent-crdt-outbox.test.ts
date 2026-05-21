import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createCrdtOutbox,
  createEmptyRoomLocalRecord,
  createIndexedDBRoomStore,
  createNoopLocalRoomStore,
  InMemoryCrdtOutbox,
  PersistentCrdtOutbox,
  ROOM_LOCAL_SCHEMA_VERSION,
} from "@slisync/sync-sdk";

async function clearSlisyncDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("slisync");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("InMemoryCrdtOutbox", () => {
  it("hydrate restores FIFO queue", () => {
    const outbox = new InMemoryCrdtOutbox();
    outbox.hydrate(["x", "y"]);
    assert.equal(outbox.size, 2);
    assert.deepEqual(outbox.drain(), ["x", "y"]);
  });
});

describe("PersistentCrdtOutbox", () => {
  afterEach(async () => {
    await clearSlisyncDb();
  });

  it("debounces outbox persistence to LocalRoomStore", async () => {
    const store = createNoopLocalRoomStore();
    const outbox = new PersistentCrdtOutbox({
      roomId: "room-debounce",
      store,
      debounceMs: 50,
    });

    outbox.enqueue("a");
    outbox.enqueue("b");
    assert.equal((await store.get("room-debounce"))?.outbox?.length ?? 0, 0);

    await delay(80);
    const saved = await store.get("room-debounce");
    assert.ok(saved);
    assert.deepEqual(saved.outbox, ["a", "b"]);
  });

  it("drain clears persisted outbox", async () => {
    const store = createNoopLocalRoomStore();
    const outbox = new PersistentCrdtOutbox({ roomId: "room-drain", store });

    outbox.enqueue("only");
    await delay(250);
    assert.deepEqual(outbox.drain(), ["only"]);
    await delay(50);

    const saved = await store.get("room-drain");
    assert.ok(saved);
    assert.deepEqual(saved.outbox, []);
  });

  it("merges outbox into an existing room record", async () => {
    const store = createNoopLocalRoomStore();
    await store.put({
      ...createEmptyRoomLocalRecord("room-merge"),
      docSnapshot: "c25hcA==",
      clientId: "cid-1",
    });

    const outbox = new PersistentCrdtOutbox({ roomId: "room-merge", store });
    outbox.enqueue("q1");
    await delay(250);

    const saved = await store.get("room-merge");
    assert.ok(saved);
    assert.equal(saved.docSnapshot, "c25hcA==");
    assert.equal(saved.clientId, "cid-1");
    assert.deepEqual(saved.outbox, ["q1"]);
  });
});

describe("createCrdtOutbox", () => {
  afterEach(async () => {
    await clearSlisyncDb();
  });

  it("persistence false returns in-memory outbox", () => {
    const outbox = createCrdtOutbox({ roomId: "r", persistence: false });
    assert.ok(outbox instanceof InMemoryCrdtOutbox);
  });

  it("injected LocalRoomStore receives debounced outbox writes", async () => {
    const injected = createNoopLocalRoomStore();
    const outbox = createCrdtOutbox({
      roomId: "room-injected",
      persistence: injected,
    });
    outbox.enqueue("p");
    await delay(250);
    assert.deepEqual((await injected.get("room-injected"))?.outbox, ["p"]);
  });

  it("persistence true uses IndexedDB when available", async () => {
    const outbox = createCrdtOutbox({
      roomId: "room-idb",
      persistence: true,
    });
    outbox.enqueue("idb-1");
    await delay(250);

    const store = createIndexedDBRoomStore();
    const saved = await store.get("room-idb");
    assert.ok(saved);
    assert.equal(saved.schemaVersion, ROOM_LOCAL_SCHEMA_VERSION);
    assert.deepEqual(saved.outbox, ["idb-1"]);
  });
});
