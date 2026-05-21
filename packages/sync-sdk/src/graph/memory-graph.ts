import * as Y from "yjs";
import {
  edgeIdFor,
  parseMemoryChunkData,
  type EdgeRelation,
  type LinkOptions,
  type MemoryChunkData,
  type MemoryEdge,
  type MemoryNode,
  type MemoryGraphSnapshot,
  type MemoryScope,
  type TraverseQuery,
  type TraverseResult,
  type UpsertNodeInput,
} from "@slisync/sync-schema";
import type { UpsertChunkInput } from "./scoped-memory";
import {
  applyLinkEdgeToDoc,
  applyUpsertNodeToDoc,
  getEdgeFromDoc,
  getNodeFromDoc,
  initMemoryGraphDoc,
  newEntityId,
  nowIso,
  readMemoryGraphSnapshot,
  wouldCreateContainsCycle,
} from "./graph-doc";
import { traverseGraph } from "./traverse";

export class MemoryGraph {
  constructor(
    private readonly doc: Y.Doc,
    private readonly actorId: string,
  ) {}

  static on(doc: Y.Doc, actorId: string): MemoryGraph {
    return new MemoryGraph(doc, actorId);
  }

  init(graphId: string, title?: string) {
    initMemoryGraphDoc(this.doc, graphId, title);
    return this;
  }

  snapshot(): MemoryGraphSnapshot | null {
    return readMemoryGraphSnapshot(this.doc);
  }

  getNode(nodeId: string, includeDeleted = false): MemoryNode | null {
    return getNodeFromDoc(this.doc, nodeId, includeDeleted);
  }

  upsertNode(input: UpsertNodeInput): MemoryNode {
    const at = nowIso();
    const existing = input.id ? getNodeFromDoc(this.doc, input.id, true) : null;
    const id = input.id ?? newEntityId("node");
    const actor = input.createdBy ?? this.actorId;

    const node: MemoryNode = {
      id,
      kind: input.kind,
      title: input.title,
      body: input.body ?? existing?.body,
      data: input.data ?? existing?.data,
      rank: input.rank ?? existing?.rank,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      createdBy: existing?.createdBy ?? actor,
      updatedBy: actor,
      tags: input.tags ?? existing?.tags ?? [],
      refs: input.refs ?? existing?.refs ?? [],
      deletedAt: undefined,
    };

    applyUpsertNodeToDoc(this.doc, node);
    return node;
  }

  /** Upsert a scoped memory_chunk node. */
  upsertChunk(input: UpsertChunkInput): MemoryNode {
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
    return this.upsertNode({
      id: input.id,
      kind: "memory_chunk",
      title: input.title,
      data: data as unknown as Record<string, unknown>,
      tags: input.tags ?? ["scope:chunk"],
      createdBy: input.createdBy,
    });
  }

  /** Update title and/or content of an existing memory_chunk node. */
  updateChunkContent(
    nodeId: string,
    patch: { title?: string; content?: string },
  ): MemoryNode {
    const existing = this.getNode(nodeId);
    if (!existing || existing.kind !== "memory_chunk") {
      throw new Error(`updateChunkContent: not a memory_chunk (${nodeId})`);
    }
    const chunk = parseMemoryChunkData(existing);
    if (!chunk) {
      throw new Error(`updateChunkContent: invalid chunk data (${nodeId})`);
    }
    return this.upsertChunk({
      id: nodeId,
      workspaceId: chunk.scope.workspaceId,
      sessionId: chunk.scope.sessionId,
      title: patch.title ?? existing.title,
      content: patch.content ?? chunk.content,
      source: chunk.source,
      importance: chunk.importance,
      tags: existing.tags,
    });
  }

  link(
    from: string,
    to: string,
    relation: EdgeRelation,
    options: LinkOptions = {},
  ): MemoryEdge {
    const fromNode = getNodeFromDoc(this.doc, from);
    const toNode = getNodeFromDoc(this.doc, to);
    if (!fromNode || !toNode) {
      throw new Error(`link: node not found (from=${from}, to=${to})`);
    }

    if (relation === "contains" && wouldCreateContainsCycle(this.doc, from, to)) {
      throw new Error("link: contains edge would create a cycle");
    }

    const at = nowIso();
    const id = options.edgeId ?? edgeIdFor(from, relation, to);
    const existingEdge = getEdgeFromDoc(this.doc, id);
    if (existingEdge && !existingEdge.deletedAt) {
      return existingEdge;
    }

    const edge: MemoryEdge = {
      id,
      kind: "edge",
      relation,
      from,
      to,
      createdAt: at,
      updatedAt: at,
      createdBy: this.actorId,
      updatedBy: this.actorId,
      tags: options.tags ?? [],
      refs: [],
      unique: options.unique ?? true,
      semantic: options.semantic
        ? {
            reason: options.semantic.reason,
            confidence: options.semantic.confidence,
            declaredBy: options.semantic.declaredBy ?? this.actorId,
          }
        : undefined,
    };

    applyLinkEdgeToDoc(this.doc, edge);
    return edge;
  }

  traverse(
    startId: string,
    query: Partial<TraverseQuery> = {},
  ): TraverseResult {
    return traverseGraph(this.doc, startId, query);
  }
}
