import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { SYNC_EVENTS } from "@slisync/sync-sdk/protocol";
import { createCrdtRoomClient } from "./helpers/crdt-room-client";
import { startTestSyncServer } from "./helpers/test-server";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("protocol version", () => {
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

  it("accepts default protocol v1 on CRDT join", async () => {
    const roomId = uniqueRoom("proto-ok");
    const client = createCrdtRoomClient({ baseUrl, roomId });
    try {
      await client.join();
    } finally {
      client.close();
    }
  });

  it("rejects incompatible protocol on CRDT join", async () => {
    const roomId = uniqueRoom("proto-bad");
    const client = createCrdtRoomClient({ baseUrl, roomId });

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("join timed out"));
        }, 8000);

        client.socket.once("connect", () => {
          client.socket
            .timeout(8000)
            .emit(
              SYNC_EVENTS.CRDT_JOIN,
              { roomId, protocolVersion: 99 },
              (err: Error | null, ack?: { error?: string; code?: string }) => {
                clearTimeout(timer);
                if (err) {
                  reject(err);
                  return;
                }
                if (ack?.error) {
                  assert.equal(ack.code, "incompatible_protocol");
                  resolve();
                  return;
                }
                reject(new Error("expected incompatible_protocol error"));
              },
            );
        });

        client.socket.connect();
      });
    } finally {
      client.close();
    }
  });
});
