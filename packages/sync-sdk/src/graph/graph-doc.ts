import * as Y from "yjs";
import {
  GRAPH_DOC_KEY,
  SCHEMA_VERSION,
  type GraphMeta,
  type MemoryEdge,
  type MemoryGraphSnapshot,
  type MemoryNode,
} from "@slisync/sync-schema";
import { readEdgeFromYMap, writeEdgeToYMap } from "./y-edge";
import { readNodeFromYMap, writeNodeToYMap } from "./y-node";

export const GRAPH_REMOTE_ORIGIN = "graph-remote";

export function nowIso(): string {
  return new Date().toISOString();
}

export function newEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getGraphRoot(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(GRAPH_DOC_KEY);
}

export function getNodesMap(root: Y.Map<unknown>): Y.Map<Y.Map<unknown>> {
  let nodes = root.get("nodes") as Y.Map<Y.Map<unknown>> | undefined;
  if (!nodes) {
    nodes = new Y.Map<Y.Map<unknown>>();
    root.set("nodes", nodes);
  }
  return nodes;
}

export function getEdgesMap(root: Y.Map<unknown>): Y.Map<Y.Map<unknown>> {
  let edges = root.get("edges") as Y.Map<Y.Map<unknown>> | undefined;
  if (!edges) {
    edges = new Y.Map<Y.Map<unknown>>();
    root.set("edges", edges);
  }
  return edges;
}

function getAdjacency(root: Y.Map<unknown>): Y.Map<unknown> {
  let adj = root.get("adjacency") as Y.Map<unknown> | undefined;
  if (!adj) {
    adj = new Y.Map<unknown>();
    root.set("adjacency", adj);
  }
  return adj;
}

function getAdjSide(
  adj: Y.Map<unknown>,
  side: "out" | "in",
): Y.Map<Y.Array<string>> {
  let map = adj.get(side) as Y.Map<Y.Array<string>> | undefined;
  if (!map) {
    map = new Y.Map<Y.Array<string>>();
    adj.set(side, map);
  }
  return map;
}

function getEdgeIdList(
  sideMap: Y.Map<Y.Array<string>>,
  nodeId: string,
): Y.Array<string> {
  let list = sideMap.get(nodeId) as Y.Array<string> | undefined;
  if (!list) {
    list = new Y.Array<string>();
    sideMap.set(nodeId, list);
  }
  return list;
}

function touchMeta(root: Y.Map<unknown>) {
  const meta = getMetaMap(root);
  meta.set("updatedAt", nowIso());
}

function getMetaMap(root: Y.Map<unknown>): Y.Map<unknown> {
  let meta = root.get("meta") as Y.Map<unknown> | undefined;
  if (!meta) {
    meta = new Y.Map<unknown>();
    root.set("meta", meta);
  }
  return meta;
}

/** Initialize empty graph under Y.Doc (idempotent). */
export function initMemoryGraphDoc(doc: Y.Doc, graphId: string, title?: string) {
  doc.transact(() => {
    const root = getGraphRoot(doc);
    if (!root.has("meta")) {
      const meta = new Y.Map<unknown>();
      meta.set("schemaVersion", SCHEMA_VERSION);
      meta.set("graphId", graphId);
      meta.set("title", title ?? graphId);
      meta.set("updatedAt", nowIso());
      root.set("meta", meta);
    }
    getNodesMap(root);
    getEdgesMap(root);
    const adj = getAdjacency(root);
    getAdjSide(adj, "out");
    getAdjSide(adj, "in");
  });
}

export function readGraphMeta(doc: Y.Doc): GraphMeta | null {
  const root = getGraphRoot(doc);
  const meta = root.get("meta") as Y.Map<unknown> | undefined;
  if (!meta) return null;

  const graphId = meta.get("graphId");
  if (typeof graphId !== "string") return null;

  const titleRaw = meta.get("title");
  const title = typeof titleRaw === "string" ? titleRaw : undefined;

  return {
    schemaVersion: SCHEMA_VERSION,
    graphId,
    title,
    updatedAt: String(meta.get("updatedAt") ?? nowIso()),
  };
}

export function readMemoryGraphSnapshot(doc: Y.Doc): MemoryGraphSnapshot | null {
  const meta = readGraphMeta(doc);
  if (!meta) return null;

  const root = getGraphRoot(doc);
  const nodesMap = getNodesMap(root);
  const edgesMap = getEdgesMap(root);

  const nodes: MemoryNode[] = [];
  nodesMap.forEach((ymap) => {
    const node = readNodeFromYMap(ymap);
    if (node) nodes.push(node);
  });

  const edges: MemoryEdge[] = [];
  edgesMap.forEach((ymap) => {
    const edge = readEdgeFromYMap(ymap);
    if (edge) edges.push(edge);
  });

  return { meta, nodes, edges };
}

export function getNodeFromDoc(
  doc: Y.Doc,
  nodeId: string,
  includeDeleted = false,
): MemoryNode | null {
  const root = getGraphRoot(doc);
  const nodesMap = getNodesMap(root);
  const ymap = nodesMap.get(nodeId);
  if (!ymap) return null;
  const node = readNodeFromYMap(ymap);
  if (!node) return null;
  if (node.deletedAt && !includeDeleted) return null;
  return node;
}

export function getEdgeFromDoc(
  doc: Y.Doc,
  edgeId: string,
  includeDeleted = false,
): MemoryEdge | null {
  const root = getGraphRoot(doc);
  const edgesMap = getEdgesMap(root);
  const ymap = edgesMap.get(edgeId);
  if (!ymap) return null;
  const edge = readEdgeFromYMap(ymap);
  if (!edge) return null;
  if (edge.deletedAt && !includeDeleted) return null;
  return edge;
}

export function applyUpsertNodeToDoc(doc: Y.Doc, node: MemoryNode) {
  doc.transact(() => {
    const root = getGraphRoot(doc);
    const nodesMap = getNodesMap(root);
    let ymap = nodesMap.get(node.id);
    if (!ymap) {
      ymap = new Y.Map<unknown>();
      nodesMap.set(node.id, ymap);
    }
    writeNodeToYMap(ymap, node);
    touchMeta(root);
  });
}

export function applyLinkEdgeToDoc(doc: Y.Doc, edge: MemoryEdge) {
  doc.transact(() => {
    const root = getGraphRoot(doc);
    const edgesMap = getEdgesMap(root);

    if (edge.unique && edgesMap.has(edge.id)) {
      const existing = readEdgeFromYMap(edgesMap.get(edge.id)!);
      if (existing && !existing.deletedAt) return;
    }

    let ymap = edgesMap.get(edge.id);
    if (!ymap) {
      ymap = new Y.Map<unknown>();
      edgesMap.set(edge.id, ymap);
    }
    writeEdgeToYMap(ymap, edge);

    const adj = getAdjacency(root);
    const out = getAdjSide(adj, "out");
    const inn = getAdjSide(adj, "in");

    const outList = getEdgeIdList(out, edge.from);
    if (!outList.toArray().includes(edge.id)) outList.push([edge.id]);

    const inList = getEdgeIdList(inn, edge.to);
    if (!inList.toArray().includes(edge.id)) inList.push([edge.id]);

    touchMeta(root);
  });
}

export function listAdjacencyEdgeIds(
  doc: Y.Doc,
  nodeId: string,
  direction: "out" | "in" | "both",
): string[] {
  const root = getGraphRoot(doc);
  const adj = getAdjacency(root);
  const ids = new Set<string>();

  if (direction === "out" || direction === "both") {
    const out = getAdjSide(adj, "out");
    const list = out.get(nodeId) as Y.Array<string> | undefined;
    list?.toArray().forEach((id) => ids.add(id));
  }

  if (direction === "in" || direction === "both") {
    const inn = getAdjSide(adj, "in");
    const list = inn.get(nodeId) as Y.Array<string> | undefined;
    list?.toArray().forEach((id) => ids.add(id));
  }

  return [...ids];
}

/** Detect whether adding `from contains to` would create a cycle. */
export function wouldCreateContainsCycle(
  doc: Y.Doc,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;

  const visited = new Set<string>();
  const stack = [to];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === from) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edgeId of listAdjacencyEdgeIds(doc, current, "out")) {
      const edge = getEdgeFromDoc(doc, edgeId);
      if (edge?.relation === "contains" && !edge.deletedAt) {
        stack.push(edge.to);
      }
    }
  }

  return false;
}
