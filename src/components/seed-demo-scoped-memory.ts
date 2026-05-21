import { buildScopedMemoryOps, type MemoryGraph } from "@slisync/sync-sdk";
import type { GraphOp, MemoryScope } from "@slisync/sync-schema";

export type SeedDemoScopedMemoryResult = {
  firstChunkId: string | null;
  workspaceNodeId: string | null;
};

/** sessionStorage key: demo auto-seed already applied for this room. */
export function demoSeedStorageKey(roomId: string): string {
  return `slisync-demo-seeded:${roomId}`;
}

/** sessionStorage key: welcome banner dismissed for this room. */
export function demoWelcomeDismissedKey(roomId: string): string {
  return `slisync-demo-welcome-dismissed:${roomId}`;
}

/**
 * Apply buildScopedMemoryOps to the live CRDT graph (Demo + manual seed button).
 * Uses ws-demo / sess-demo when scope matches Demo defaults.
 */
export function seedDemoScopedMemory(
  graph: MemoryGraph,
  actorId: string,
  scope: MemoryScope,
): SeedDemoScopedMemoryResult {
  const ops = buildScopedMemoryOps(
    actorId,
    scope.workspaceId,
    scope.sessionId,
  );
  applyGraphOps(graph, ops);

  let firstChunkId: string | null = null;
  let workspaceNodeId: string | null = null;
  for (const op of ops) {
    if (op.op !== "upsertNode") continue;
    if (op.node.kind === "workspace" && !workspaceNodeId) {
      workspaceNodeId = op.node.id;
    }
    if (op.node.kind === "memory_chunk" && !firstChunkId) {
      firstChunkId = op.node.id;
    }
  }

  return { firstChunkId, workspaceNodeId };
}

function applyGraphOps(graph: MemoryGraph, ops: GraphOp[]): void {
  for (const op of ops) {
    if (op.op === "upsertNode") {
      graph.upsertNode({
        id: op.node.id,
        kind: op.node.kind,
        title: op.node.title,
        body: op.node.body,
        data: op.node.data,
        tags: op.node.tags,
      });
    } else if (op.op === "upsertEdge") {
      graph.link(op.edge.from, op.edge.to, op.edge.relation, {
        edgeId: op.edge.id,
        unique: op.edge.unique,
      });
    }
  }
}
