import type { MemoryEdge, MemoryGraphSnapshot, MemoryNode } from "@slisync/sync-schema";

function activeNodes(nodes: MemoryNode[]): Map<string, MemoryNode> {
  const map = new Map<string, MemoryNode>();
  for (const node of nodes) {
    if (!node.deletedAt) map.set(node.id, node);
  }
  return map;
}

function activeEdges(edges: MemoryEdge[]): Map<string, MemoryEdge> {
  const map = new Map<string, MemoryEdge>();
  for (const edge of edges) {
    if (!edge.deletedAt) map.set(edge.id, edge);
  }
  return map;
}

function nodeSignature(node: MemoryNode): string {
  return `${node.title}|${node.updatedAt}|${node.kind}`;
}

function edgeSignature(edge: MemoryEdge): string {
  return `${edge.relation}|${edge.from}|${edge.to}|${edge.updatedAt}`;
}

/**
 * Human-readable summary when graph snapshot changed; null if no graph diff.
 */
export function summarizeGraphSnapshotDiff(
  before: MemoryGraphSnapshot | null,
  after: MemoryGraphSnapshot | null,
): string | null {
  const bNodes = activeNodes(before?.nodes ?? []);
  const aNodes = activeNodes(after?.nodes ?? []);
  const bEdges = activeEdges(before?.edges ?? []);
  const aEdges = activeEdges(after?.edges ?? []);

  let nodesAdded = 0;
  let nodesUpdated = 0;
  let nodesRemoved = 0;
  const newTitles: string[] = [];

  for (const [id, node] of aNodes) {
    const prev = bNodes.get(id);
    if (!prev) {
      nodesAdded += 1;
      if (newTitles.length < 2) newTitles.push(node.title);
    } else if (nodeSignature(prev) !== nodeSignature(node)) {
      nodesUpdated += 1;
      if (newTitles.length < 2) newTitles.push(node.title);
    }
  }

  for (const id of bNodes.keys()) {
    if (!aNodes.has(id)) nodesRemoved += 1;
  }

  let edgesAdded = 0;
  let edgesUpdated = 0;
  let edgesRemoved = 0;

  for (const [id, edge] of aEdges) {
    const prev = bEdges.get(id);
    if (!prev) {
      edgesAdded += 1;
    } else if (edgeSignature(prev) !== edgeSignature(edge)) {
      edgesUpdated += 1;
    }
  }

  for (const id of bEdges.keys()) {
    if (!aEdges.has(id)) edgesRemoved += 1;
  }

  const changed =
    nodesAdded +
      nodesUpdated +
      nodesRemoved +
      edgesAdded +
      edgesUpdated +
      edgesRemoved >
    0;

  if (!changed) return null;

  const parts: string[] = [];
  if (nodesAdded) parts.push(`${nodesAdded} node(s) added`);
  if (nodesUpdated) parts.push(`${nodesUpdated} node(s) updated`);
  if (nodesRemoved) parts.push(`${nodesRemoved} node(s) removed`);
  if (edgesAdded) parts.push(`${edgesAdded} edge(s) added`);
  if (edgesUpdated) parts.push(`${edgesUpdated} edge(s) updated`);
  if (edgesRemoved) parts.push(`${edgesRemoved} edge(s) removed`);

  const base = parts.join(", ");
  if (newTitles.length === 0) return base;
  return `${base} — ${newTitles.join(", ")}`;
}
