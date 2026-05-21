import {
  edgeIdFor,
  nodeMatchesMemoryScope,
  type GraphOp,
  type MemoryChunkData,
  type MemoryEdge,
  type MemoryNode,
  type MemoryScope,
} from "@slisync/sync-schema";
import { newEntityId, nowIso } from "./graph-doc";

export type UpsertChunkInput = {
  workspaceId: string;
  sessionId?: string;
  title: string;
  content: string;
  source?: string;
  importance?: number;
  tags?: string[];
  id?: string;
  createdBy?: string;
};

/** Build workspace → session → memory_chunk demo graph. */
export function buildScopedMemoryOps(
  actorId: string,
  workspaceId = "ws-demo",
  sessionId = "sess-demo",
): GraphOp[] {
  const at = nowIso();
  const wsNodeId = newEntityId("node");
  const sessNodeId = newEntityId("node");
  const chunk1Id = newEntityId("node");
  const chunk2Id = newEntityId("node");

  const workspace: MemoryNode = {
    id: wsNodeId,
    kind: "workspace",
    title: "Demo Workspace",
    body: "Shared AI memory workspace",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["scope:workspace"],
    refs: [],
    data: { workspaceId },
  };

  const session: MemoryNode = {
    id: sessNodeId,
    kind: "session",
    title: "Demo Session",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["scope:session"],
    refs: [],
    data: { workspaceId, sessionId },
  };

  const chunk1 = buildChunkNode(actorId, chunk1Id, {
    workspaceId,
    sessionId,
    title: "User asked about CRDT sync",
    content: "Explain Yjs merge vs LWW optimistic locking for shared memory.",
    source: "chat",
    importance: 0.9,
  });

  const chunk2 = buildChunkNode(actorId, chunk2Id, {
    workspaceId,
    sessionId,
    title: "Agent summarized graph ops",
    content: "Agent pushed workspace/session/chunk nodes via graphOps.",
    source: "agent",
    importance: 0.7,
  });

  const containsWs = edgeIdFor(wsNodeId, "contains", sessNodeId);
  const containsSess = edgeIdFor(sessNodeId, "contains", chunk1Id);
  const relatedChunk = edgeIdFor(chunk1Id, "related_to", chunk2Id);

  const edgeWsSession: MemoryEdge = {
    id: containsWs,
    kind: "edge",
    relation: "contains",
    from: wsNodeId,
    to: sessNodeId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const edgeSessionChunk: MemoryEdge = {
    id: containsSess,
    kind: "edge",
    relation: "contains",
    from: sessNodeId,
    to: chunk1Id,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const edgeChunks: MemoryEdge = {
    id: relatedChunk,
    kind: "edge",
    relation: "related_to",
    from: chunk1Id,
    to: chunk2Id,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
  };

  return [
    { op: "upsertNode", node: workspace },
    { op: "upsertNode", node: session },
    { op: "upsertNode", node: chunk1 },
    { op: "upsertNode", node: chunk2 },
    { op: "upsertEdge", edge: edgeWsSession },
    { op: "upsertEdge", edge: edgeSessionChunk },
    { op: "upsertEdge", edge: edgeChunks },
  ];
}

function buildChunkNode(
  actorId: string,
  id: string,
  input: {
    workspaceId: string;
    sessionId?: string;
    title: string;
    content: string;
    source?: string;
    importance?: number;
  },
): MemoryNode {
  const at = nowIso();
  const scope: MemoryScope = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
  };
  const data: MemoryChunkData = {
    scope,
    content: input.content,
    source: input.source,
    importance: input.importance,
  };

  return {
    id,
    kind: "memory_chunk",
    title: input.title,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["scope:chunk"],
    refs: [],
    data: data as unknown as Record<string, unknown>,
  };
}

export function filterNodesByScope(
  nodes: MemoryNode[],
  filter: Partial<MemoryScope>,
): MemoryNode[] {
  return nodes.filter((n) => !n.deletedAt && nodeMatchesMemoryScope(n, filter));
}
