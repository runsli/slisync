import { edgeIdFor, type GraphOp, type MemoryEdge, type MemoryNode } from "@slisync/sync-schema";
import { newEntityId, nowIso } from "./graph-doc";

/** Build a demo project → task → file graph for agent seeding. */
export function buildDemoGraphOps(actorId: string): GraphOp[] {
  const at = nowIso();
  const projectId = newEntityId("node");
  const taskId = newEntityId("node");
  const fileId = newEntityId("node");

  const project: MemoryNode = {
    id: projectId,
    kind: "project",
    title: "AI Memory Graph",
    body: "Demo project for realtime graph sync",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["team:infra"],
    refs: [],
    data: { status: "active" },
  };

  const task: MemoryNode = {
    id: taskId,
    kind: "task",
    title: "Wire graph to CRDT room",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    data: { status: "done" },
  };

  const file: MemoryNode = {
    id: fileId,
    kind: "file",
    title: "memory-graph.ts",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    data: { path: "packages/sync-sdk/src/graph/memory-graph.ts" },
  };

  const containsId = edgeIdFor(projectId, "contains", taskId);
  const refsId = edgeIdFor(taskId, "references", fileId);

  const contains: MemoryEdge = {
    id: containsId,
    kind: "edge",
    relation: "contains",
    from: projectId,
    to: taskId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const references: MemoryEdge = {
    id: refsId,
    kind: "edge",
    relation: "references",
    from: taskId,
    to: fileId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  return [
    { op: "upsertNode", node: project },
    { op: "upsertNode", node: task },
    { op: "upsertNode", node: file },
    { op: "upsertEdge", edge: contains },
    { op: "upsertEdge", edge: references },
  ];
}
