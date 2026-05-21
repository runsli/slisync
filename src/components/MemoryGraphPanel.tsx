"use client";

import { useMemo, useState } from "react";
import {
  buildScopedMemoryOps,
  filterNodesByScope,
  useMemoryGraph,
} from "@slisync/sync-sdk";
import {
  parseMemoryChunkData,
  type MemoryNode,
  type MemoryScope,
} from "@slisync/sync-schema";
import { GraphNodeDetail } from "./GraphNodeDetail";
import { GraphTreeView, type GraphLayoutMode } from "./GraphTreeView";

type Props = {
  graphId: string;
  actorId: string;
  syncReady: boolean;
  getCrdtDocument: () => import("yjs").Doc | null;
  notifyGraphActivity?: (summary: string) => void;
};

const DEFAULT_SCOPE: MemoryScope = {
  workspaceId: "ws-demo",
  sessionId: "sess-demo",
};

export function MemoryGraphPanel({
  graphId,
  actorId,
  syncReady,
  getCrdtDocument,
}: Props) {
  const { graph, snapshot, ready } = useMemoryGraph({
    graphId,
    actorId,
    syncReady,
    getDocument: getCrdtDocument,
  });

  const [rootId, setRootId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>("tree");
  const [scope, setScope] = useState<MemoryScope>(DEFAULT_SCOPE);

  const activeNodes = useMemo(
    () => (snapshot?.nodes ?? []).filter((n) => !n.deletedAt),
    [snapshot?.nodes],
  );

  const activeEdges = useMemo(
    () => (snapshot?.edges ?? []).filter((e) => !e.deletedAt),
    [snapshot?.edges],
  );

  const scopedNodes = useMemo(
    () => filterNodesByScope(activeNodes, scope),
    [activeNodes, scope],
  );

  const workspace = activeNodes.find((n) => n.kind === "workspace");
  const session = activeNodes.find(
    (n) =>
      n.kind === "session" &&
      (n.data?.workspaceId === scope.workspaceId ||
        n.data?.sessionId === scope.sessionId),
  );
  const traverseRoot =
    rootId ?? workspace?.id ?? session?.id ?? scopedNodes[0]?.id ?? null;

  const displayNodes = scopedNodes.length > 0 ? scopedNodes : activeNodes;
  const selectedNode =
    displayNodes.find((n) => n.id === (selectedId ?? traverseRoot)) ?? null;

  const seedScoped = () => {
    if (!graph) return;
    const ops = buildScopedMemoryOps(actorId, scope.workspaceId, scope.sessionId);
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
    const ws = activeNodes.find((n) => n.kind === "workspace") ?? workspace;
    setRootId(ws?.id ?? null);
  };

  const addChunk = () => {
    if (!graph) return;
    const parent =
      session?.id ??
      workspace?.id ??
      traverseRoot;
    const chunk = graph.upsertChunk({
      workspaceId: scope.workspaceId,
      sessionId: scope.sessionId,
      title: "New memory chunk",
      content: `Chunk at ${new Date().toLocaleTimeString()}`,
      source: "ui",
    });
    if (parent) {
      graph.link(parent, chunk.id, "contains");
    }
    setRootId(parent ?? chunk.id);
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Memory Graph
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-0.5 text-[10px] dark:border-zinc-700">
          {(["tree", "force"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLayoutMode(mode)}
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

      <div className="flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-1 text-zinc-500">
          workspace
          <input
            className="w-24 rounded border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-700"
            value={scope.workspaceId}
            onChange={(e) =>
              setScope((s) => ({ ...s, workspaceId: e.target.value }))
            }
          />
        </label>
        <label className="flex items-center gap-1 text-zinc-500">
          session
          <input
            className="w-24 rounded border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-700"
            value={scope.sessionId ?? ""}
            onChange={(e) =>
              setScope((s) => ({ ...s, sessionId: e.target.value || undefined }))
            }
          />
        </label>
      </div>

      {!syncReady ? (
        <p className="text-xs text-zinc-500">等待 CRDT 同步完成后可编辑图…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={seedScoped}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Seed workspace/session/chunk
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={addChunk}
            className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs text-violet-800 hover:bg-violet-50 disabled:opacity-40 dark:border-violet-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
          >
            + memory_chunk
          </button>
        </div>
      )}

      <GraphTreeView
        layoutMode={layoutMode}
        rootId={traverseRoot}
        nodes={displayNodes}
        edges={activeEdges}
        selectedId={selectedId ?? traverseRoot}
        onSelectNode={(id) => {
          setSelectedId(id);
          if (layoutMode === "tree") setRootId(id);
        }}
      />

      <GraphNodeDetail node={selectedNode} />

      {scopedNodes.length > 0 ? (
        <details className="text-xs text-zinc-500" open>
          <summary className="cursor-pointer">
            Scoped chunks ({scopedNodes.filter((n) => n.kind === "memory_chunk").length})
          </summary>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {scopedNodes
              .filter((n) => n.kind === "memory_chunk")
              .map((n: MemoryNode) => {
                const chunk = parseMemoryChunkData(n);
                return (
                  <li key={n.id} className="rounded bg-zinc-50 px-2 py-1 dark:bg-zinc-900/60">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(n.id);
                        setRootId(n.id);
                      }}
                      className="text-left font-medium hover:text-violet-600 dark:hover:text-violet-400"
                    >
                      {n.title}
                    </button>
                    {chunk ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] opacity-80">
                        {chunk.content}
                      </p>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
