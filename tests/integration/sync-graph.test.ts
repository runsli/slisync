import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
import {
  buildDemoGraphOps,
  fetchGraphTraverseHttp,
  MemoryGraph,
  pushGraphOpsHttp,
} from "@slisync/sync-sdk/graph";
import { createCrdtRoomClient } from "./helpers/crdt-room-client";
import { startTestSyncServer } from "./helpers/test-server";

const HUMAN_KEY = "test-human-key";
const AGENT_KEY = "test-agent-key";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("sync graph integration", () => {
  describe("socket agent seed + CRDT", () => {
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

    it("seeds demo graph and client receives nodes via CRDT", async () => {
      const roomId = uniqueRoom("seed");
      const client = createCrdtRoomClient({ baseUrl, roomId });

      try {
        await client.join();

        const ack = await pushAgentMemory({
          url: baseUrl,
          roomId,
          agentId: "it-agent",
          action: "seed_graph",
          graphOps: buildDemoGraphOps("it-agent"),
        });

        assert.equal(ack.ok, true);

        const snap = await client.waitForGraph((g) => g.nodes.length >= 3);
        const titles = snap.nodes.map((n) => n.title);
        assert.ok(titles.includes("AI Memory Graph"));
        assert.ok(titles.includes("Wire graph to CRDT room"));
        assert.equal(snap.edges.length, 2);
      } finally {
        client.close();
      }
    });

    it("late joiner receives graph snapshot from room", async () => {
      const roomId = uniqueRoom("late");
      const watcher = createCrdtRoomClient({ baseUrl, roomId });

      try {
        const ack = await pushAgentMemory({
          url: baseUrl,
          roomId,
          agentId: "it-agent",
          action: "seed_graph",
          graphOps: buildDemoGraphOps("it-agent"),
        });
        assert.equal(ack.ok, true);

        await watcher.join();
        const snap = await watcher.waitForGraph((g) => g.nodes.length >= 3);
        assert.ok(snap.nodes.some((n) => n.kind === "project"));
      } finally {
        watcher.close();
      }
    });

    it("peer receives GRAPH_ACTIVITY when human pushes graph via CRDT only", async () => {
      const roomId = uniqueRoom("crdt-graph-activity");
      const watcher = createCrdtRoomClient({ baseUrl, roomId });
      const writer = createCrdtRoomClient({ baseUrl, roomId });

      try {
        await watcher.join();
        await writer.join();

        writer.pushGraphOps(buildDemoGraphOps("writer-human"), "writer-human");
        await writer.waitForGraph((g) => g.nodes.length >= 3);

        const activity = await watcher.waitForGraphActivity();
        assert.equal(activity.source, "human");
        assert.match(activity.summary, /node|edge/i);
        await watcher.waitForGraph((g) => g.nodes.length >= 3);
        assert.equal(watcher.graphActivities.length, 1);
        assert.equal(writer.graphActivities.length, 0);
      } finally {
        watcher.close();
        writer.close();
      }
    });

    it("connected client receives CRDT update and graph activity on seed", async () => {
      const roomId = uniqueRoom("live");
      const client = createCrdtRoomClient({ baseUrl, roomId });

      try {
        await client.join();

        const ack = await pushAgentMemory({
          url: baseUrl,
          roomId,
          agentId: "it-agent",
          action: "seed_graph",
          graphOps: buildDemoGraphOps("it-agent"),
        });
        assert.equal(ack.ok, true);

        await client.waitForGraph((g) => g.nodes.length >= 3);

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("GRAPH_ACTIVITY not received"));
          }, 5000);

          const check = () => {
            if (client.graphActivities.length > 0) {
              clearTimeout(timer);
              resolve();
              return;
            }
            setTimeout(check, 30);
          };
          check();
        });

        assert.equal(client.graphActivities[0]?.source, "agent");
        assert.match(client.graphActivities[0]?.summary ?? "", /node|edge|upsert/i);
      } finally {
        client.close();
      }
    });
  });

  describe("HTTP graph ops", () => {
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

    it("POST /v1/graphs/:roomId/ops applies graph and CRDT client syncs", async () => {
      const roomId = uniqueRoom("http");
      const client = createCrdtRoomClient({ baseUrl, roomId });

      try {
        await client.join();

        const result = await pushGraphOpsHttp({
          baseUrl,
          roomId,
          agentId: "http-agent",
          action: "seed_graph_http",
          graphOps: buildDemoGraphOps("http-agent"),
        });

        assert.equal(result.ok, true);
        if (!result.ok) return;

        const snap = await client.waitForGraph((g) => g.nodes.length >= 3);
        assert.ok(snap.nodes.some((n) => n.title === "AI Memory Graph"));
      } finally {
        client.close();
      }
    });

    it("GET traverse returns subgraph after HTTP seed", async () => {
      const roomId = uniqueRoom("traverse");
      const ops = buildDemoGraphOps("http-agent");
      const projectOp = ops.find(
        (op): op is Extract<typeof op, { op: "upsertNode" }> =>
          op.op === "upsertNode" && op.node.kind === "project",
      );
      assert.ok(projectOp);

      const push = await pushGraphOpsHttp({
        baseUrl,
        roomId,
        agentId: "http-agent",
        action: "seed_graph_http",
        graphOps: ops,
      });
      assert.equal(push.ok, true);

      const walk = await fetchGraphTraverseHttp({
        baseUrl,
        roomId,
        startId: projectOp.node.id,
        query: {
          direction: "out",
          maxDepth: 3,
          relations: ["contains", "references"],
        },
      });

      assert.equal(walk.ok, true);
      if (!walk.ok) return;
      assert.equal(walk.result.nodes.length, 3);
      assert.equal(walk.result.edges.length, 2);
      assert.equal(walk.result.truncated, false);
      assert.ok(
        walk.result.nodes.some((n) => n.title === "Wire graph to CRDT room"),
      );
    });

    it("idempotency key returns same successful body", async () => {
      const roomId = uniqueRoom("idem");
      const key = `idem-${Date.now()}`;
      const opts = {
        baseUrl,
        roomId,
        agentId: "http-agent",
        action: "seed_graph_http",
        graphOps: buildDemoGraphOps("http-agent"),
        idempotencyKey: key,
      };

      const first = await pushGraphOpsHttp(opts);
      const second = await pushGraphOpsHttp(opts);

      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      if (first.ok && second.ok) {
        assert.equal(first.version, second.version);
        assert.equal(first.summary, second.summary);
      }
    });
  });

  describe("auth", () => {
    const auth = {
      required: true,
      apiKey: HUMAN_KEY,
      agentApiKey: AGENT_KEY,
    };

    let baseUrl = "";
    let closeServer: () => Promise<void> = async () => {};

    before(async () => {
      const server = await startTestSyncServer(auth);
      baseUrl = server.baseUrl;
      closeServer = server.close;
    });

    after(async () => {
      await closeServer();
    });

    it("rejects CRDT join without token", async () => {
      const roomId = uniqueRoom("auth-join");
      const client = createCrdtRoomClient({ baseUrl, roomId });

      try {
        await assert.rejects(
          () => client.join(),
          /token|auth/i,
        );
      } finally {
        client.close();
      }
    });

    it("allows CRDT join with human token", async () => {
      const roomId = uniqueRoom("auth-ok");
      const client = createCrdtRoomClient({
        baseUrl,
        roomId,
        token: HUMAN_KEY,
      });

      try {
        await client.join();
        const snap = MemoryGraph.on(client.doc, "test").snapshot();
        assert.equal(snap?.nodes.length ?? 0, 0);
      } finally {
        client.close();
      }
    });

    it("rejects socket agent push without agent token", async () => {
      const roomId = uniqueRoom("auth-agent");
      const ack = await pushAgentMemory({
        url: baseUrl,
        roomId,
        agentId: "bad-agent",
        action: "seed_graph",
        graphOps: buildDemoGraphOps("bad-agent"),
      });

      assert.equal(ack.ok, false);
      assert.match(ack.error ?? "", /token/i);
    });

    it("accepts socket agent push with agent token", async () => {
      const roomId = uniqueRoom("auth-agent-ok");
      const client = createCrdtRoomClient({
        baseUrl,
        roomId,
        token: HUMAN_KEY,
      });

      try {
        await client.join();

        const ack = await pushAgentMemory({
          url: baseUrl,
          roomId,
          agentId: "good-agent",
          action: "seed_graph",
          graphOps: buildDemoGraphOps("good-agent"),
          token: AGENT_KEY,
        });

        assert.equal(ack.ok, true);
        await client.waitForGraph((g) => g.nodes.length >= 3);
      } finally {
        client.close();
      }
    });

    it("rejects HTTP graph ops without token", async () => {
      const roomId = uniqueRoom("auth-http");
      const result = await pushGraphOpsHttp({
        baseUrl,
        roomId,
        agentId: "http-agent",
        action: "seed",
        graphOps: buildDemoGraphOps("http-agent"),
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 401);
        assert.match(result.error, /token/i);
      }
    });

    it("accepts HTTP graph ops with bearer agent token", async () => {
      const roomId = uniqueRoom("auth-http-ok");
      const result = await pushGraphOpsHttp({
        baseUrl,
        roomId,
        agentId: "http-agent",
        action: "seed",
        graphOps: buildDemoGraphOps("http-agent"),
        token: AGENT_KEY,
      });

      assert.equal(result.ok, true);
    });

    it("rejects GET traverse without token", async () => {
      const roomId = uniqueRoom("auth-traverse");
      const result = await fetchGraphTraverseHttp({
        baseUrl,
        roomId,
        startId: "any-node",
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 401);
      }
    });

    it("allows GET traverse with agent token after seed", async () => {
      const roomId = uniqueRoom("auth-traverse-ok");
      const ops = buildDemoGraphOps("http-agent");
      const projectOp = ops.find(
        (op): op is Extract<typeof op, { op: "upsertNode" }> =>
          op.op === "upsertNode" && op.node.kind === "project",
      );
      assert.ok(projectOp);

      await pushGraphOpsHttp({
        baseUrl,
        roomId,
        agentId: "http-agent",
        action: "seed",
        graphOps: ops,
        token: AGENT_KEY,
      });

      const walk = await fetchGraphTraverseHttp({
        baseUrl,
        roomId,
        startId: projectOp.node.id,
        token: AGENT_KEY,
      });

      assert.equal(walk.ok, true);
      if (walk.ok) {
        assert.ok(walk.result.nodes.length >= 1);
      }
    });
  });
});
