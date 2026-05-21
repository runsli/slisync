import * as Y from "yjs";
import {
  DEFAULT_TRAVERSE,
  TRAVERSE_LIMITS,
  nodeMatchesMemoryScope,
  type EdgeRelation,
  type MemoryEdge,
  type MemoryNode,
  type TraverseQuery,
  type TraverseResult,
} from "@slisync/sync-schema";
import {
  getEdgeFromDoc,
  getNodeFromDoc,
  listAdjacencyEdgeIds,
} from "./graph-doc";

function clampQuery(query: Partial<TraverseQuery>): TraverseQuery {
  return {
    direction: query.direction ?? DEFAULT_TRAVERSE.direction,
    relations: query.relations,
    maxDepth: Math.min(
      query.maxDepth ?? DEFAULT_TRAVERSE.maxDepth,
      TRAVERSE_LIMITS.maxDepth,
    ),
    maxNodes: Math.min(
      query.maxNodes ?? DEFAULT_TRAVERSE.maxNodes,
      TRAVERSE_LIMITS.maxNodes,
    ),
    includeDeleted: query.includeDeleted ?? DEFAULT_TRAVERSE.includeDeleted,
    tagFilter: query.tagFilter,
    kinds: query.kinds,
    scopeFilter: query.scopeFilter,
  };
}

function nodeMatchesFilters(
  node: MemoryNode,
  query: TraverseQuery,
): boolean {
  if (!query.includeDeleted && node.deletedAt) return false;
  if (query.kinds && !query.kinds.includes(node.kind)) return false;
  if (query.tagFilter && query.tagFilter.length > 0) {
    const tagSet = new Set(node.tags);
    if (!query.tagFilter.every((t) => tagSet.has(t))) return false;
  }
  if (query.scopeFilter) {
    if (!nodeMatchesMemoryScope(node, query.scopeFilter)) return false;
  }
  return true;
}

function edgeMatchesFilters(
  edge: MemoryEdge,
  query: TraverseQuery,
): boolean {
  if (!query.includeDeleted && edge.deletedAt) return false;
  if (query.relations && !query.relations.includes(edge.relation)) return false;
  return true;
}

/**
 * BFS traversal from `startId` using materialized adjacency lists.
 */
export function traverseGraph(
  doc: Y.Doc,
  startId: string,
  partialQuery: Partial<TraverseQuery> = {},
): TraverseResult {
  const query = clampQuery(partialQuery);
  const rootNode = getNodeFromDoc(doc, startId, query.includeDeleted);

  const nodes = new Map<string, MemoryNode>();
  const edges = new Map<string, MemoryEdge>();
  let truncated = false;

  if (!rootNode) {
    return { rootId: startId, nodes: [], edges: [], truncated: false };
  }

  if (nodeMatchesFilters(rootNode, query)) {
    nodes.set(rootNode.id, rootNode);
  }

  type Frame = { nodeId: string; depth: number };
  const queue: Frame[] = [{ nodeId: startId, depth: 0 }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (depth >= query.maxDepth) continue;

    const edgeIds = listAdjacencyEdgeIds(doc, nodeId, query.direction);

    for (const edgeId of edgeIds) {
      const edge = getEdgeFromDoc(doc, edgeId, query.includeDeleted);
      if (!edge || !edgeMatchesFilters(edge, query)) continue;

      edges.set(edge.id, edge);

      const nextId =
        query.direction === "in"
          ? edge.from
          : query.direction === "out"
            ? edge.to
            : edge.from === nodeId
              ? edge.to
              : edge.from;

      const nextNode = getNodeFromDoc(doc, nextId, query.includeDeleted);
      if (!nextNode) continue;

      if (nodeMatchesFilters(nextNode, query) && !nodes.has(nextNode.id)) {
        if (nodes.size >= query.maxNodes) {
          truncated = true;
          break;
        }
        nodes.set(nextNode.id, nextNode);
      }

      if (!visited.has(nextId) && depth + 1 < query.maxDepth) {
        visited.add(nextId);
        queue.push({ nodeId: nextId, depth: depth + 1 });
      }
    }

    if (truncated) break;
  }

  return {
    rootId: startId,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    truncated,
  };
}
