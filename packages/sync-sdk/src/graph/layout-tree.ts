import type { MemoryEdge, MemoryNode } from "@slisync/sync-schema";

export type TreeLayoutNode = {
  id: string;
  title: string;
  kind: string;
  x: number;
  y: number;
};

export type TreeLayoutEdge = {
  id: string;
  relation: string;
  from: string;
  to: string;
};

export type TreeLayout = {
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
  width: number;
  height: number;
};

const NODE_W = 128;
const NODE_H = 40;
const GAP_X = 20;
const GAP_Y = 56;
const PAD = 16;

const TREE_RELATIONS = new Set(["contains", "references", "related_to"]);

/**
 * Layered tree layout from root using outbound edges (demo-friendly).
 */
export function layoutGraphTree(
  rootId: string,
  allNodes: MemoryNode[],
  allEdges: MemoryEdge[],
): TreeLayout | null {
  const nodeMap = new Map(
    allNodes.filter((n) => !n.deletedAt).map((n) => [n.id, n]),
  );
  if (!nodeMap.has(rootId)) return null;

  const edges = allEdges.filter(
    (e) =>
      !e.deletedAt &&
      TREE_RELATIONS.has(e.relation) &&
      nodeMap.has(e.from) &&
      nodeMap.has(e.to),
  );

  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const list = childrenOf.get(e.from) ?? [];
    list.push(e.to);
    childrenOf.set(e.from, list);
  }

  const levels: string[][] = [];
  const visited = new Set<string>();
  let frontier = [rootId];
  visited.add(rootId);

  while (frontier.length > 0) {
    levels.push(frontier);
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of childrenOf.get(id) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        next.push(child);
      }
    }
    frontier = next;
  }

  const layoutNodes: TreeLayoutNode[] = [];
  let maxRowWidth = 0;

  levels.forEach((row, depth) => {
    const rowWidth = row.length * NODE_W + (row.length - 1) * GAP_X;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    const startX = -rowWidth / 2 + NODE_W / 2;

    row.forEach((id, index) => {
      const n = nodeMap.get(id)!;
      layoutNodes.push({
        id,
        title: n.title,
        kind: n.kind,
        x: startX + index * (NODE_W + GAP_X),
        y: depth * (NODE_H + GAP_Y),
      });
    });
  });

  const pos = new Map(layoutNodes.map((n) => [n.id, n]));
  const layoutEdges: TreeLayoutEdge[] = edges
    .filter((e) => pos.has(e.from) && pos.has(e.to))
    .map((e) => ({
      id: e.id,
      relation: e.relation,
      from: e.from,
      to: e.to,
    }));

  const width = Math.max(maxRowWidth + PAD * 2, 280);
  const height =
    levels.length * (NODE_H + GAP_Y) - GAP_Y + PAD * 2 + NODE_H;

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}

export function edgePath(
  from: TreeLayoutNode,
  to: TreeLayoutNode,
): string {
  const x1 = from.x;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y - NODE_H / 2;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

export { NODE_W, NODE_H };
