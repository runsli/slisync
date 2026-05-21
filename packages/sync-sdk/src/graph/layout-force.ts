import type { MemoryEdge, MemoryNode } from "@slisync/sync-schema";
import type { TreeLayout, TreeLayoutEdge, TreeLayoutNode } from "./layout-tree";
import { NODE_H, NODE_W } from "./layout-tree";

const ITERATIONS = 48;
const REPULSE = 4200;
const ATTRACT = 0.012;
const DAMPING = 0.85;
const PAD = 24;

type SimNode = {
  id: string;
  title: string;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

/**
 * Lightweight force-directed layout for demo graphs (no extra deps).
 */
export function layoutGraphForce(
  rootId: string | null,
  allNodes: MemoryNode[],
  allEdges: MemoryEdge[],
): TreeLayout | null {
  const nodes = allNodes.filter((n) => !n.deletedAt);
  if (nodes.length === 0) return null;

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = allEdges.filter(
    (e) =>
      !e.deletedAt &&
      nodeIds.has(e.from) &&
      nodeIds.has(e.to),
  );

  const sim: SimNode[] = nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const r = 40 + nodes.length * 6;
    return {
      id: n.id,
      title: n.title,
      kind: n.kind,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    };
  });

  const simMap = new Map(sim.map((n) => [n.id, n]));
  if (rootId && simMap.has(rootId)) {
    const root = simMap.get(rootId)!;
    root.x = 0;
    root.y = 0;
  }

  for (let step = 0; step < ITERATIONS; step++) {
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i];
        const b = sim[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1) {
          dx = (Math.random() - 0.5) * 2;
          dy = (Math.random() - 0.5) * 2;
          dist = Math.hypot(dx, dy) || 1;
        }
        const force = REPULSE / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const e of edges) {
      const a = simMap.get(e.from);
      const b = simMap.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = dist * ATTRACT;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    for (const n of sim) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of sim) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }

  const layoutNodes: TreeLayoutNode[] = sim.map((n) => ({
    id: n.id,
    title: n.title,
    kind: n.kind,
    x: n.x - (minX + maxX) / 2,
    y: n.y - (minY + maxY) / 2,
  }));

  const pos = new Map(layoutNodes.map((n) => [n.id, n]));
  const layoutEdges: TreeLayoutEdge[] = edges
    .filter((e) => pos.has(e.from) && pos.has(e.to))
    .map((e) => ({
      id: e.id,
      relation: e.relation,
      from: e.from,
      to: e.to,
    }));

  const width = Math.max(maxX - minX + NODE_W + PAD * 2, 320);
  const height = Math.max(maxY - minY + NODE_H + PAD * 2, 200);

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}
