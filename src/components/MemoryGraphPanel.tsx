"use client";

import { useMemo } from "react";
import { filterNodesByScope } from "@slisync/sync-sdk";
import type { MemoryEdge, MemoryNode, MemoryScope } from "@slisync/sync-schema";
import { GraphTreeView, type GraphLayoutMode } from "./GraphTreeView";

export type MemoryGraphPanelProps = {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  scope: MemoryScope;
  syncReady: boolean;
  ready: boolean;
  selectedId: string | null;
  rootId: string | null;
  layoutMode: GraphLayoutMode;
  onSelectNode: (id: string) => void;
  onLayoutModeChange: (mode: GraphLayoutMode) => void;
  onAddChunk: () => void;
  onSeed: () => void;
};

/** Graph tree navigation for scoped memory (controlled by parent). */
export function MemoryGraphPanel({
  nodes,
  edges,
  scope,
  syncReady,
  ready,
  selectedId,
  rootId,
  layoutMode,
  onSelectNode,
  onLayoutModeChange,
  onAddChunk,
  onSeed,
}: MemoryGraphPanelProps) {
  const scopedNodes = useMemo(
    () => filterNodesByScope(nodes, scope),
    [nodes, scope],
  );

  const workspace = nodes.find((n) => n.kind === "workspace");
  const session = nodes.find(
    (n) =>
      n.kind === "session" &&
      (n.data?.workspaceId === scope.workspaceId ||
        n.data?.sessionId === scope.sessionId),
  );

  const traverseRoot =
    rootId ?? workspace?.id ?? session?.id ?? scopedNodes[0]?.id ?? null;

  const displayNodes = scopedNodes.length > 0 ? scopedNodes : nodes;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          图导航
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-0.5 text-[10px] dark:border-zinc-700">
          {(["tree", "force"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onLayoutModeChange(mode)}
              className={`rounded px-2 py-0.5 ${
                layoutMode === mode
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500"
              }`}
            >
              {mode === "tree" ? "树形" : "力导向"}
            </button>
          ))}
        </div>
      </div>

      {!syncReady ? (
        <p className="text-xs text-zinc-500">等待 CRDT 同步完成后可编辑图…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={onSeed}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            初始化演示工作区
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={onAddChunk}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            + 新建 memory_chunk
          </button>
        </div>
      )}

      <GraphTreeView
        layoutMode={layoutMode}
        rootId={traverseRoot}
        nodes={displayNodes}
        edges={edges}
        selectedId={selectedId ?? traverseRoot}
        onSelectNode={(id) => {
          onSelectNode(id);
        }}
      />
    </div>
  );
}
