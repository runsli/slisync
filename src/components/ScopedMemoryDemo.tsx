"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterNodesByScope,
  useMemoryGraph,
  type AgentActivityPayload,
} from "@slisync/sync-sdk";
import type { MemoryScope, PresenceMember } from "@slisync/sync-schema";
import { DemoAgentPushHint } from "./demo-agent-push-hint";
import { MemoryChunkEditor } from "./MemoryChunkEditor";
import { MemoryGraphPanel } from "./MemoryGraphPanel";
import { MemoryScopeBar } from "./MemoryScopeBar";
import {
  demoSeedStorageKey,
  demoWelcomeDismissedKey,
  seedDemoScopedMemory,
  type SeedDemoScopedMemoryResult,
} from "./seed-demo-scoped-memory";
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
  presenceMembers?: PresenceMember[];
  lastAgentActivity?: AgentActivityPayload | null;
};

/** Primary demo shell: scoped memory graph navigation + chunk editor. */
export function ScopedMemoryDemo({
  graphId,
  actorId,
  syncReady,
  getCrdtDocument,
  notifyGraphActivity,
  presenceMembers = [],
  lastAgentActivity = null,
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
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(demoWelcomeDismissedKey(graphId)) === "1") {
        setWelcomeDismissed(true);
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [graphId]);

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

  const applySeedResult = useCallback((result: SeedDemoScopedMemoryResult) => {
    if (result.workspaceNodeId) setRootId(result.workspaceNodeId);
    if (result.firstChunkId) {
      setSelectedId(result.firstChunkId);
      setEditorFocusToken((t) => t + 1);
    }
  }, []);

  const runSeed = useCallback(
    (markAutoSeed: boolean) => {
      if (!graph) return;
      const result = seedDemoScopedMemory(graph, actorId, scope);
      applySeedResult(result);
      if (markAutoSeed) {
        try {
          sessionStorage.setItem(demoSeedStorageKey(graphId), "1");
        } catch {
          /* ignore */
        }
      }
      notifyGraphActivity?.(
        markAutoSeed ? "auto-seeded scoped memory" : "seeded scoped memory workspace",
      );
    },
    [graph, actorId, scope, graphId, applySeedResult, notifyGraphActivity],
  );

  const seedScoped = useCallback(() => runSeed(false), [runSeed]);

  useEffect(() => {
    if (!syncReady || !graph || !ready) return;
    if (activeNodes.length > 0) return;
    try {
      if (sessionStorage.getItem(demoSeedStorageKey(graphId))) return;
    } catch {
      return;
    }
    runSeed(true);
  }, [
    syncReady,
    ready,
    graph,
    activeNodes.length,
    graphId,
    runSeed,
  ]);

  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    try {
      sessionStorage.setItem(demoWelcomeDismissedKey(graphId), "1");
    } catch {
      /* ignore */
    }
  };

  const addChunk = () => {
    if (!graph) return;
    const parent = session?.id ?? workspace?.id ?? traverseRoot;
    const chunk = graph.upsertChunk({
      workspaceId: scope.workspaceId,
      sessionId: scope.sessionId,
      title: "新建记忆块",
      content: `创建于 ${new Date().toLocaleString()}`,
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

      {!welcomeDismissed ? (
        <div
          role="region"
          aria-label="使用引导"
          className="relative rounded-lg border border-violet-200 bg-white/80 p-3 pr-10 text-sm dark:border-violet-800 dark:bg-violet-950/50"
        >
          <button
            type="button"
            aria-label="关闭引导"
            className="absolute right-2 top-2 rounded px-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            onClick={dismissWelcome}
          >
            关闭
          </button>
          <p className="mb-2 font-medium text-violet-900 dark:text-violet-100">
            快速开始（约 3 步）
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-violet-900/90 dark:text-violet-100/90">
            <li>在上方选择或确认工作区 / 会话（默认 ws-demo / sess-demo）</li>
            <li>左侧选 chunk 或点「+ 新建 memory_chunk」，在右侧编辑标题与内容</li>
            <li>再开一浏览器窗口同地址，或复制下方 Agent 命令在终端执行</li>
          </ol>
          <div className="mt-3">
            <DemoAgentPushHint scope={scope} compact />
          </div>
        </div>
      ) : null}

      {lastAgentActivity ? (
        <div
          role="status"
          className="rounded-lg border border-violet-300 bg-violet-100/80 px-3 py-2 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-100"
        >
          <span className="font-medium">Agent 写入记忆</span>
          <span className="mx-1">·</span>
          <span className="font-medium">{lastAgentActivity.entry.agentId}</span>
          <span className="mx-1">·</span>
          {lastAgentActivity.entry.action}: {lastAgentActivity.entry.summary}
          <p className="mt-1 text-xs opacity-80">
            当前 scope {scope.workspaceId}
            {scope.sessionId ? ` / ${scope.sessionId}` : ""} — 若含 graphOps，左侧图与右侧
            chunk 会随 CRDT 更新；message 历史见底部「旧版共享字段」折叠区。
          </p>
        </div>
      ) : null}

      <MemoryScopeBar
        scope={scope}
        nodes={activeNodes}
        onScopeChange={setScope}
        presenceMembers={presenceMembers}
        syncReady={syncReady}
      />

      {isEmpty ? (
        <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 bg-white/60 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            尚无 workspace / session / memory_chunk 节点
          </p>
          <p className="text-xs text-zinc-500">
            连接同步后将自动写入演示数据（每个浏览器会话仅一次）；也可手动点击下方按钮。
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

      <DemoAgentPushHint scope={scope} />
    </section>
  );
}
