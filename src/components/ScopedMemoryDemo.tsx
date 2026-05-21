"use client";

import { useMemo, useState } from "react";
import {
  buildScopedMemoryOps,
  filterNodesByScope,
  useMemoryGraph,
} from "@slisync/sync-sdk";
import type { MemoryScope } from "@slisync/sync-schema";
import { MemoryChunkEditor } from "./MemoryChunkEditor";
import { MemoryGraphPanel } from "./MemoryGraphPanel";
import { MemoryScopeBar } from "./MemoryScopeBar";
import type { GraphLayoutMode } from "./GraphTreeView";

const DEFAULT_SCOPE: MemoryScope = {
  workspaceId: "ws-demo",
  sessionId: "sess-demo",
};

export type ScopedMemoryDemoProps = {
  graphId: string;
  actorId: string;
  syncReady: boolean;
  getCrdtDocument: () => import("yjs").Doc | null;
  notifyGraphActivity?: (summary: string) => void;
};

/** Primary demo shell: scoped memory graph navigation + chunk editor. */
export function ScopedMemoryDemo({
  graphId,
  actorId,
  syncReady,
  getCrdtDocument,
  notifyGraphActivity,
}: ScopedMemoryDemoProps) {
  const { graph, snapshot, ready } = useMemoryGraph({
    graphId,
    actorId,
    syncReady,
    getDocument: getCrdtDocument,
  });

  const [scope, setScope] = useState<MemoryScope>(DEFAULT_SCOPE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>("tree");
  const [editorFocusToken, setEditorFocusToken] = useState(0);

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
    let firstChunkId: string | null = null;
    for (const op of ops) {
      if (op.op === "upsertNode" && op.node.kind === "memory_chunk" && !firstChunkId) {
        firstChunkId = op.node.id;
      }
    }
    const ws = activeNodes.find((n) => n.kind === "workspace") ?? workspace;
    setRootId(ws?.id ?? null);
    if (firstChunkId) {
      setSelectedId(firstChunkId);
      setEditorFocusToken((t) => t + 1);
    }
    notifyGraphActivity?.("seeded scoped memory workspace");
  };

  const addChunk = () => {
    if (!graph) return;
    const parent = session?.id ?? workspace?.id ?? traverseRoot;
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
    setSelectedId(chunk.id);
    setRootId(parent ?? chunk.id);
    setEditorFocusToken((t) => t + 1);
    notifyGraphActivity?.(`created chunk ${chunk.title}`);
  };

  const handleSelectNode = (id: string) => {
    setSelectedId(id);
    if (layoutMode === "tree") setRootId(id);
  };

  const isEmpty = activeNodes.length === 0;

  return (
    <section className="space-y-4 rounded-xl border border-violet-200/80 bg-violet-50/30 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">
          共享记忆 · Scoped Memory
        </p>
        <p className="text-sm text-violet-900/90 dark:text-violet-100/90">
          在同一 room 内按 workspace / session 组织 memory_chunk，左侧导航、右侧编辑。
        </p>
      </div>

      <MemoryScopeBar
        scope={scope}
        nodes={activeNodes}
        onScopeChange={setScope}
      />

      {isEmpty ? (
        <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 bg-white/60 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            尚无 workspace / session / memory_chunk 节点
          </p>
          <p className="text-xs text-zinc-500">
            点击下方按钮写入演示图，或等待其他客户端 / Agent 同步数据。
          </p>
          <button
            type="button"
            disabled={!ready || !syncReady}
            onClick={seedScoped}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            初始化演示工作区
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="min-h-[16rem] rounded-lg border border-zinc-200 bg-white/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <MemoryGraphPanel
              nodes={activeNodes}
              edges={activeEdges}
              scope={scope}
              syncReady={syncReady}
              ready={ready}
              selectedId={selectedId}
              rootId={rootId}
              layoutMode={layoutMode}
              onSelectNode={handleSelectNode}
              onLayoutModeChange={setLayoutMode}
              onAddChunk={addChunk}
              onSeed={seedScoped}
            />
          </div>
          <div className="min-h-[16rem] rounded-lg border border-zinc-200 bg-white/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              记忆块编辑
            </p>
            <MemoryChunkEditor
              node={selectedNode}
              graph={graph}
              ready={ready}
              syncReady={syncReady}
              focusToken={editorFocusToken}
            />
          </div>
        </div>
      )}
    </section>
  );
}
