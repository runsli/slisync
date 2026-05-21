import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as Y from "yjs";
import { parseTaskData } from "@slisync/sync-schema";
import {
  applyGraphOps,
  buildDemoTaskOps,
  filterTasksByScope,
  MemoryGraph,
  readMemoryGraphSnapshot,
} from "@slisync/sync-sdk/graph";

describe("MemoryGraph task API", () => {
  it("upsertTask creates a parseable task node", () => {
    const doc = new Y.Doc();
    const graph = MemoryGraph.on(doc, "actor").init("task-unit");
    const node = graph.upsertTask({
      workspaceId: "ws-1",
      sessionId: "sess-1",
      title: "Write tests",
      status: "todo",
      priority: 1,
    });
    assert.equal(node.kind, "task");
    const parsed = parseTaskData(node);
    assert.deepEqual(parsed, {
      scope: { workspaceId: "ws-1", sessionId: "sess-1" },
      status: "todo",
      priority: 1,
    });
  });

  it("updateTaskStatus changes status and preserves scope", () => {
    const doc = new Y.Doc();
    const graph = MemoryGraph.on(doc, "actor").init("task-status");
    const created = graph.upsertTask({
      workspaceId: "ws-2",
      title: "Ship Phase 1",
      status: "todo",
    });
    const updated = graph.updateTaskStatus(created.id, "in_progress", {
      assigneeId: "user-a",
    });
    const parsed = parseTaskData(updated);
    assert.equal(parsed?.status, "in_progress");
    assert.equal(parsed?.assigneeId, "user-a");
    assert.equal(parsed?.scope.workspaceId, "ws-2");
  });

  it("updateTaskStatus rejects non-task nodes", () => {
    const doc = new Y.Doc();
    const graph = MemoryGraph.on(doc, "actor").init("task-reject");
    const chunk = graph.upsertChunk({
      workspaceId: "ws-1",
      title: "note",
      content: "body",
    });
    assert.throws(
      () => graph.updateTaskStatus(chunk.id, "done"),
      /not a task/,
    );
  });
});

describe("filterTasksByScope", () => {
  it("counts demo tasks for workspace and session", () => {
    const doc = new Y.Doc();
    MemoryGraph.on(doc, "actor").init("task-filter");
    applyGraphOps(
      doc,
      buildDemoTaskOps("actor", "ws-demo", "sess-demo"),
      "actor",
    );
    const snapshot = readMemoryGraphSnapshot(doc);
    assert.ok(snapshot);

    const inScope = filterTasksByScope(snapshot.nodes, {
      workspaceId: "ws-demo",
      sessionId: "sess-demo",
    });
    assert.equal(inScope.length, 3);

    const otherSession = filterTasksByScope(snapshot.nodes, {
      workspaceId: "ws-demo",
      sessionId: "other",
    });
    assert.equal(otherSession.length, 0);

    const statuses = inScope
      .map((n) => parseTaskData(n)?.status)
      .filter(Boolean);
    assert.ok(statuses.includes("todo"));
    assert.ok(statuses.includes("in_progress"));
    assert.ok(statuses.includes("done"));
  });
});

describe("buildDemoTaskOps", () => {
  it("includes contains, depends_on, and assigned_to edges", () => {
    const ops = buildDemoTaskOps("actor", "ws-x", "sess-x");
    const edges = ops.filter((o) => o.op === "upsertEdge");
    const relations = edges.map((o) =>
      o.op === "upsertEdge" ? o.edge.relation : "",
    );
    assert.ok(relations.includes("contains"));
    assert.ok(relations.includes("depends_on"));
    assert.ok(relations.includes("assigned_to"));
    assert.ok(ops.filter((o) => o.op === "upsertNode").length >= 5);
  });
});
