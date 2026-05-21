import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildDemoGraphOps } from "@slisync/sync-sdk/graph";
import { withAuthEnv } from "./helpers/env";
import { createCrdtRoomClient } from "./helpers/crdt-room-client";
import { startTestSyncServer } from "./helpers/test-server";

const REDIS_URL = process.env.REDIS_URL?.trim();

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("redis socket.io cluster", { skip: !REDIS_URL }, () => {
  let closeA: () => Promise<void> = async () => {};
  let closeB: () => Promise<void> = async () => {};
  let baseUrlA = "";
  let baseUrlB = "";

  before(async () => {
    await withAuthEnv(undefined, async () => {
      process.env.SYNC_SOCKET_ADAPTER = "1";

      const a = await startTestSyncServer();
      const b = await startTestSyncServer();
      baseUrlA = a.baseUrl;
      baseUrlB = b.baseUrl;
      closeA = a.close;
      closeB = b.close;

      assert.equal(a.sync.socketRedisAdapter != null, true);
      assert.equal(b.sync.socketRedisAdapter != null, true);
    });
  });

  after(async () => {
    delete process.env.SYNC_SOCKET_ADAPTER;
    await closeA();
    await closeB();
  });

  it("broadcasts CRDT graph updates across two server instances", async () => {
    const roomId = uniqueRoom("cluster");
    const watcher = createCrdtRoomClient({ baseUrl: baseUrlB, roomId });
    const writer = createCrdtRoomClient({ baseUrl: baseUrlA, roomId });

    try {
      await watcher.join();
      await writer.join();

      writer.pushGraphOps(buildDemoGraphOps("cluster-writer"), "cluster-writer");
      await watcher.waitForGraph((g) => g.nodes.length >= 3);

      const activity = await watcher.waitForGraphActivity(15_000);
      assert.equal(activity.source, "human");
    } finally {
      watcher.close();
      writer.close();
    }
  });
});
