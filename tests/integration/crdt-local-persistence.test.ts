import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as Y from "yjs";
import {
  createCrdtSyncClient,
  createEmptyRoomLocalRecord,
  createNoopLocalRoomStore,
  createSyncStore,
} from "@slisync/sync-sdk";
import {
  encodeDocumentSnapshot,
  initSharedMemoryDoc,
  readSharedMemoryState,
  updateMessage,
} from "@slisync/sync-sdk/crdt/shared-memory-doc";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import { startTestSyncServer } from "./helpers/test-server";

const DEFAULT_STATE = {
  message: "Hello from shared memory",
  counter: 0,
};

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function waitFor(
  predicate: () => boolean,
  timeoutMs = 12_000,
  intervalMs = 50,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("waitFor timeout"));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function waitForPersistedSnapshot(
  store: ReturnType<typeof createNoopLocalRoomStore>,
  roomId: string,
  timeoutMs = 12_000,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const saved = await store.get(roomId);
    if (saved?.docSnapshot?.length) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("persisted snapshot not found");
}

describe("CRDT local persistence", () => {
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

  it("hydrates doc snapshot from LocalRoomStore before server join", async () => {
    const roomId = uniqueRoom("local-hydrate");
    const localStore = createNoopLocalRoomStore();
    const offlineMessage = `offline-${Date.now()}`;

    const seedDoc = new Y.Doc();
    initSharedMemoryDoc(seedDoc, DEFAULT_STATE);
    updateMessage(seedDoc, DEFAULT_STATE.message, offlineMessage);
    await localStore.put({
      ...createEmptyRoomLocalRecord(roomId),
      docSnapshot: encodeUpdate(encodeDocumentSnapshot(seedDoc)),
    });
    seedDoc.destroy();

    const store = createSyncStore(DEFAULT_STATE);
    const client = createCrdtSyncClient({
      roomId,
      defaultState: DEFAULT_STATE,
      store,
      localPersistence: localStore,
      url: baseUrl,
    });

    try {
      client.connect();
      await waitFor(() => store.getState().data.message === offlineMessage);
      assert.equal(
        readSharedMemoryState(client.getDocument()!).message,
        offlineMessage,
      );
      await waitFor(() => store.getState().syncReady);
    } finally {
      client.disconnect();
    }
  });

  it("second client instance restores local snapshot after disconnect", async () => {
    const roomId = uniqueRoom("local-reopen");
    const localStore = createNoopLocalRoomStore();
    const edited = `reopen-${Date.now()}`;

    const store1 = createSyncStore(DEFAULT_STATE);
    const client1 = createCrdtSyncClient({
      roomId,
      defaultState: DEFAULT_STATE,
      store: store1,
      localPersistence: localStore,
      url: baseUrl,
    });

    try {
      client1.connect();
      await waitFor(() => store1.getState().syncReady);
      const doc = client1.getDocument()!;
      updateMessage(
        doc,
        readSharedMemoryState(doc).message,
        edited,
      );
      await waitFor(() => store1.getState().data.message === edited);
      client1.disconnect();
      await waitForPersistedSnapshot(localStore, roomId);
    } finally {
      try {
        client1.disconnect();
      } catch {
        /* already disconnected */
      }
    }

    const store2 = createSyncStore(DEFAULT_STATE);
    const client2 = createCrdtSyncClient({
      roomId,
      defaultState: DEFAULT_STATE,
      store: store2,
      localPersistence: localStore,
      url: baseUrl,
    });

    try {
      client2.connect();
      await waitFor(() => store2.getState().data.message === edited);
    } finally {
      client2.disconnect();
    }
  });
});
