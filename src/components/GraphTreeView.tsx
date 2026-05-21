"use client";

import type { MemoryEdge, MemoryNode } from "@slisync/sync-schema";
import {
  edgePath,
  fillForNodeKind,
  layoutGraphForce,
  layoutGraphTree,
  NODE_H,
  NODE_W,
} from "@slisync/sync-sdk/graph";

export type GraphLayoutMode = "tree" | "force";

type Props = {
  layoutMode: GraphLayoutMode;
  rootId: string | null;
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  selectedId: string | null;
  onSelectNode: (id: string) => void;
};

export function GraphTreeView({
  layoutMode,
  rootId,
  nodes,
  edges,
  selectedId,
  onSelectNode,
}: Props) {
  const layout =
    layoutMode === "force"
      ? layoutGraphForce(rootId, nodes, edges)
      : rootId
        ? layoutGraphTree(rootId, nodes, edges)
        : null;

  if (!layout || layout.nodes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-8 text-center text-xs text-zinc-400 dark:border-zinc-700">
        选择节点作为根，或 seed 图后查看
        {layoutMode === "tree" ? "树形" : "力导向"}视图
      </p>
    );
  }

  const pos = new Map(layout.nodes.map((n) => [n.id, n]));
  const offsetX = layout.width / 2;
  const offsetY = 12;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
      <svg
        width={layout.width}
        height={layout.height}
        className="mx-auto block"
        role="img"
        aria-label={`Memory graph ${layoutMode}`}
      >
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          {layout.edges.map((e) => {
            const from = pos.get(e.from);
            const to = pos.get(e.to);
            if (!from || !to) return null;
            return (
              <g key={e.id}>
                <path
                  d={edgePath(from, to)}
                  fill="none"
                  stroke="currentColor"
                  className="text-zinc-300 dark:text-zinc-600"
                  strokeWidth={1.5}
                />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 + NODE_H / 2}
                  textAnchor="middle"
                  className="fill-violet-500 text-[9px] dark:fill-violet-400"
                >
                  {e.relation}
                </text>
              </g>
            );
          })}

          {layout.nodes.map((n) => {
            const selected = selectedId === n.id;
            const fill = fillForNodeKind(n.kind);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x - NODE_W / 2}, ${n.y - NODE_H / 2})`}
                className="cursor-pointer"
                onClick={() => onSelectNode(n.id)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={fill}
                  stroke={selected ? "#8b5cf6" : "#d4d4d8"}
                  strokeWidth={selected ? 2 : 1}
                />
                <text
                  x={NODE_W / 2}
                  y={14}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[9px] font-medium uppercase"
                >
                  {n.kind}
                </text>
                <text
                  x={NODE_W / 2}
                  y={28}
                  textAnchor="middle"
                  className="fill-zinc-800 text-[11px] dark:fill-zinc-200"
                >
                  {n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
