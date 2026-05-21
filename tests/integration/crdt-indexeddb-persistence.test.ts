import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import * as Y from "yjs";
import {
  createCrdtSyncClient,
  createEmptyRoomLocalRecord,
  createIndexedDBRoomStore,
  createSyncStore,
} from "@slisync/sync-sdk";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import {
  encodeDocumentSnapshot,
  initSharedMemoryDoc,
  readSharedMemoryState,
  updateMessage,
} from "@slisync/sync-sdk/crdt/shared-memory-doc";
import { createCrdtRoomClient } from "./helpers/crdt-room-client";
import {
  clearSlisyncDb,
  delay,
  uniqueRoom,
  waitFor,
} from "./helpers/sync-test-utils";
import { startTestSyncServer } from "./helpers/test-server";

const DEFAULT_STATE = {
  message: "Hello from shared memory",
  counter: 0,
};

describe("CRDT IndexedDB persistence", () => {
  let baseUrl = "";
  let closeServer: () => Promise<void> = async () => {};

  before(async () => {
    const server = await startTestSyncServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer();
  });

  afterEach(async () => {
    await clearSlisyncDb();
    await delay(10);
  });

  it("replays persisted outbox after new client instance joins (reader receives edit)", async () => {
    const roomId = uniqueRoom("idb-replay");
    const offlineMessage = `idb-offline-${Date.now()}`;
    const idb = createIndexedDBRoomStore();

    const seedDoc = new Y.Doc();
    initSharedMemoryDoc(seedDoc, DEFAULT_STATE);
    const snapshotDefault = encodeUpdate(encodeDocumentSnapshot(seedDoc));
    updateMessage(seedDoc, DEFAULT_STATE.message, offlineMessage);
    const outboxUpdate = encodeUpdate(Y.encodeStateAsUpdate(seedDoc));

    await idb.put({
      ...createEmptyRoomLocalRecord(roomId),
      docSnapshot: snapshotDefault,
      outbox: [outboxUpdate],
    });
    seedDoc.destroy();

    const store = createSyncStore(DEFAULT_STATE);
    const client = createCrdtSyncClient({
      roomId,
      defaultState: DEFAULT_STATE,
      store,
      localPersistence: idb,
      url: baseUrl,
    });

    const reader = createCrdtRoomClient({ baseUrl, roomId });

    try {
      client.connect();
      await waitFor(() => store.getState().syncReady);
      await waitFor(() => store.getState().outboxSize === 0);

      await reader.join();

      await waitFor(
        () => readSharedMemoryState(reader.doc).message === offlineMessage,
      );
      assert.equal(readSharedMemoryState(reader.doc).message, offlineMessage);
    } finally {
      reader.close();
      client.disconnect();
    }
  });

  it("clears outbox in IndexedDB after flush on sync", async () => {
    const roomId = uniqueRoom("idb-outbox-clear");
    const idb = createIndexedDBRoomStore();
    const queuedMessage = `idb-queued-${Date.now()}`;

    const seedDoc = new Y.Doc();
    initSharedMemoryDoc(seedDoc, DEFAULT_STATE);
    const snapshotDefault = encodeUpdate(encodeDocumentSnapshot(seedDoc));
    updateMessage(seedDoc, DEFAULT_STATE.message, queuedMessage);
    const outboxUpdate = encodeUpdate(Y.encodeStateAsUpdate(seedDoc));

    await idb.put({
      ...createEmptyRoomLocalRecord(roomId),
      docSnapshot: snapshotDefault,
      outbox: [outboxUpdate],
    });
    seedDoc.destroy();

    const store = createSyncStore(DEFAULT_STATE);
    const client = createCrdtSyncClient({
      roomId,
      defaultState: DEFAULT_STATE,
      store,
      localPersistence: idb,
      url: baseUrl,
    });

    try {
      client.connect();
      await waitFor(() => store.getState().syncReady);
      await waitFor(() => store.getState().outboxSize === 0);
      await delay(300);

      const saved = await idb.get(roomId);
      assert.ok(saved);
      assert.deepEqual(saved.outbox, []);
    } finally {
      client.disconnect();
    }
  });
});
