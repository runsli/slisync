import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  buildScopedMemoryOps,
  fetchGraphTraverseHttp,
  pushGraphOpsHttp,
} from "@slisync/sync-sdk/graph";
import { SYNC_EVENTS } from "@slisync/sync-sdk/protocol";
import type { PresenceStatePayload } from "@slisync/sync-schema";
import { createCrdtRoomClient } from "./helpers/crdt-room-client";
import { startTestSyncServer } from "./helpers/test-server";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("scoped memory and presence", () => {
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

  it("seeds workspace/session/chunk graph and traverses with scopeFilter", async () => {
    const roomId = uniqueRoom("scoped");
    const ops = buildScopedMemoryOps("scope-agent");
    const wsOp = ops.find(
      (o) => o.op === "upsertNode" && o.node.kind === "workspace",
    );
    assert.equal(wsOp?.op, "upsertNode");
    const rootId = wsOp?.op === "upsertNode" ? wsOp.node.id : "";

    const push = await pushGraphOpsHttp({
      baseUrl,
      roomId,
      agentId: "scope-agent",
      action: "seed_scoped",
      graphOps: ops,
    });
    assert.equal(push.ok, true);

    const traverse = await fetchGraphTraverseHttp({
      baseUrl,
      roomId,
      startId: rootId,
      query: {
        scopeFilter: { workspaceId: "ws-demo", sessionId: "sess-demo" },
        kinds: ["memory_chunk"],
        maxDepth: 4,
        maxNodes: 20,
      },
    });
    assert.equal(traverse.ok, true);
    if (traverse.ok) {
      assert.ok(traverse.result.nodes.length >= 2);
      assert.ok(
        traverse.result.nodes.every((n) => n.kind === "memory_chunk"),
      );
    }
  });

  it("broadcasts presence when two clients join the same room", async () => {
    const roomId = uniqueRoom("presence");

    const a = createCrdtRoomClient({ baseUrl, roomId });
    const b = createCrdtRoomClient({ baseUrl, roomId });

    const bPresence = new Promise<PresenceStatePayload>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("PRESENCE_STATE timeout")),
        12_000,
      );
      b.socket.on(SYNC_EVENTS.PRESENCE_STATE, (payload: PresenceStatePayload) => {
        if (payload?.members?.length >= 2) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    try {
      await a.join();
      a.socket.emit(SYNC_EVENTS.PRESENCE_JOIN, {
        roomId,
        clientId: "client-a",
        actorId: "human-a",
        status: "online",
      });

      await b.join();
      b.socket.emit(SYNC_EVENTS.PRESENCE_JOIN, {
        roomId,
        clientId: "client-b",
        actorId: "human-b",
        status: "online",
      });

      const state = await bPresence;
      assert.equal(state.roomId, roomId);
      assert.deepEqual(
        state.members.map((m) => m.clientId).sort(),
        ["client-a", "client-b"],
      );
    } finally {
      a.close();
      b.close();
    }
  });
});
