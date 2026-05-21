import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as Y from "yjs";
import { applyRemoteUpdate, decodeUpdate, encodeUpdate } from "@slisync/sync-sdk/crdt";
import {
  readSharedMemoryState,
  updateMessage,
} from "@slisync/sync-sdk/crdt/shared-memory-doc";
import { CrdtUpdateOutbox } from "@slisync/sync-sdk";
import { SYNC_EVENTS } from "@slisync/sync-sdk/protocol";
import { createCrdtRoomClient } from "./helpers/crdt-room-client";
import { startTestSyncServer } from "./helpers/test-server";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("CRDT offline outbox", () => {
  it("queues and drains FIFO encoded updates", () => {
    const outbox = new CrdtUpdateOutbox();
    outbox.enqueue("a");
    outbox.enqueue("b");
    assert.equal(outbox.size, 2);
    assert.deepEqual(outbox.drain(), ["a", "b"]);
    assert.equal(outbox.size, 0);
  });

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

  it("replays queued local edits after reconnect", async () => {
    const roomId = uniqueRoom("outbox");
    const writer = createCrdtRoomClient({ baseUrl, roomId });
    const reader = createCrdtRoomClient({ baseUrl, roomId });

    try {
      await writer.join();
      await reader.join();

      const offlineMessage = `offline-${Date.now()}`;
      writer.socket.disconnect();
      updateMessage(writer.doc, "Hello from shared memory", offlineMessage);
      const queued = encodeUpdate(Y.encodeStateAsUpdate(writer.doc));

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("reconnect timeout")),
          12_000,
        );
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        if (writer.socket.connected) {
          done();
          return;
        }
        writer.socket.once("connect", done);
        writer.socket.connect();
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("CRDT re-join timed out")),
          12_000,
        );
        writer.socket
          .timeout(12_000)
          .emit(
            SYNC_EVENTS.CRDT_JOIN,
            { roomId },
            (err: Error | null, ack?: { error?: string; update?: string }) => {
              clearTimeout(timer);
              if (err) {
                reject(err);
                return;
              }
              if (ack?.error) {
                reject(new Error(ack.error));
                return;
              }
              if (ack?.update) {
                applyRemoteUpdate(writer.doc, decodeUpdate(ack.update));
              }
              resolve();
            },
          );
      });

      writer.socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update: queued });

      const received = await new Promise<boolean>((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          const msg = readSharedMemoryState(reader.doc).message;
          if (msg === offlineMessage) {
            resolve(true);
            return;
          }
          if (Date.now() - started > 12_000) {
            reject(
              new Error(`reader did not receive offline edit (message=${msg})`),
            );
            return;
          }
          setTimeout(tick, 50);
        };
        tick();
      });

      assert.equal(received, true);
    } finally {
      writer.close();
      reader.close();
    }
  });
});
