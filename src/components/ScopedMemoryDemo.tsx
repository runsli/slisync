"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchExportChunksZipHttp,
  filterNodesByScope,
  getAgentSyncToken,
  useMemoryGraph,
  type AgentActivityPayload,
} from "@slisync/sync-sdk";
import type {
  GraphActivityPayload,
  MemoryScope,
  PresenceMember,
} from "@slisync/sync-schema";
import { DemoAgentPushHint } from "./demo-agent-push-hint";
import { MemoryChunkEditor } from "./MemoryChunkEditor";
import { MemoryGraphPanel } from "./MemoryGraphPanel";
import { MemoryScopeBar } from "./MemoryScopeBar";
import { TaskBoardPanel } from "./TaskBoardPanel";
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
  lastGraphActivity?: GraphActivityPayload | null;
};

type DemoTab = "memory" | "tasks";

type ExportToast = { kind: "ok" | "error"; text: string };

/** Trigger browser download of a zip blob returned by the export HTTP API. */
function downloadZipBlob(blob: ArrayBuffer, filename: string) {
  const zipBlob = new Blob([blob], { type: "application/zip" });
  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Primary demo shell: scoped memory graph navigation + chunk editor. */
export function ScopedMemoryDemo({
  graphId,
  actorId,
  syncReady,
  getCrdtDocument,
  notifyGraphActivity,
  presenceMembers = [],
  lastAgentActivity = null,
  lastGraphActivity = null,
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
  const [activeTab, setActiveTab] = useState<DemoTab>("memory");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<ExportToast | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

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

  /** Pull memory_chunk Markdown from the sync server as a zip download. */
  const exportMarkdownHttp = useCallback(async () => {
    setExportToast(null);
    setExportBusy(true);
    try {
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await fetchExportChunksZipHttp({
        roomId: graphId,
        baseUrl,
        token: getAgentSyncToken(),
        workspaceId: scope.workspaceId,
        sessionId: scope.sessionId,
      });
      if (!result.ok) {
        setExportToast({
          kind: "error",
          text: result.error || "导出失败",
        });
        return;
      }
      if (result.blob.byteLength < 4) {
        setExportToast({
          kind: "error",
          text: "当前工作区还没有可导出的记忆片段。请先点「初始化演示工作区」，或运行 npm run graph:seed",
        });
        return;
      }
      downloadZipBlob(result.blob, result.filename);
      setExportToast({
        kind: "ok",
        text: `已下载 ${result.filename}，可将 zip 内 Markdown 用于建站或发布`,
      });
    } catch (err) {
      setExportToast({
        kind: "error",
        text: err instanceof Error ? err.message : "导出请求失败",
      });
    } finally {
      setExportBusy(false);
    }
  }, [graphId, scope.workspaceId, scope.sessionId]);

  return (
    <section className="space-y-4 rounded-xl border border-violet-200/80 bg-violet-50/30 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">
          共享记忆
        </p>
        <p className="text-sm text-violet-900/90 dark:text-violet-100/90">
          左侧选项目与会话，右侧写记忆片段；其它窗口或终端里的 Agent 写入会实时出现在这里。
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
            3 分钟上手
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-violet-900/90 dark:text-violet-100/90">
            <li>确认上方「工作区 / 会话」（演示默认为演示项目 / 演示会话）</li>
            <li>左侧点一条记忆或「新建记忆片段」，在右侧写标题与正文</li>
            <li>再开一个浏览器窗口访问同一地址，看两边是否同步；或复制下方命令让 Agent 代写</li>
            <li>切到「任务看板」查看待办与进度（可先运行 npm run task:seed）</li>
          </ol>
          <div className="mt-3">
            <DemoAgentPushHint scope={scope} compact />
          </div>
        </div>
      ) : null}

      <div
        className="inline-flex rounded-lg border border-violet-200/80 p-0.5 dark:border-violet-800/60"
        role="tablist"
        aria-label="Demo 主视图"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "memory"}
          onClick={() => setActiveTab("memory")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "memory"
              ? "bg-violet-600 text-white dark:bg-violet-500"
              : "text-violet-800 hover:bg-violet-100/80 dark:text-violet-200 dark:hover:bg-violet-950/60"
          }`}
        >
          记忆
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "tasks"}
          onClick={() => setActiveTab("tasks")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tasks"
              ? "bg-amber-600 text-white dark:bg-amber-600"
              : "text-amber-900 hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-950/60"
          }`}
        >
          任务看板
        </button>
      </div>

      {activeTab === "memory" && lastAgentActivity ? (
        <div
          role="status"
          className="rounded-lg border border-violet-300 bg-violet-100/80 px-3 py-2 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-100"
        >
          <span className="font-medium">有 Agent 刚更新了记忆</span>
          <span className="mx-1">·</span>
          <span className="font-medium">{lastAgentActivity.entry.agentId}</span>
          <span className="mx-1">·</span>
          {lastAgentActivity.entry.action}: {lastAgentActivity.entry.summary}
          <p className="mt-1 text-xs opacity-80">
            左侧列表与右侧编辑器会自动刷新。若是任务相关动态，请打开「任务看板」查看。
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

      {activeTab === "memory" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!syncReady || exportBusy}
            onClick={() => void exportMarkdownHttp()}
            className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-900 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/50"
          >
            {exportBusy ? "打包中…" : "导出为 Markdown 草稿（zip）"}
          </button>
          <span className="text-xs text-violet-800/70 dark:text-violet-200/70">
            仅导出当前工作区下的记忆片段，可用于青笺 / 静态博客
          </span>
        </div>
      ) : null}

      {exportToast ? (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            exportToast.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
              : "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100"
          }`}
        >
          {exportToast.text}
          <button
            type="button"
            className="ml-2 text-xs underline opacity-80"
            onClick={() => setExportToast(null)}
          >
            关闭
          </button>
        </div>
      ) : null}

      {activeTab === "memory" ? (
        isEmpty ? (
          <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 bg-white/60 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              还没有演示用的项目记忆
            </p>
            <p className="text-xs text-zinc-500">
              连上同步后会自动填入示例（每个浏览器标签页仅一次）；也可点击下方按钮立即创建。
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
        )
      ) : (
        <TaskBoardPanel
          graph={graph}
          snapshot={snapshot}
          scope={scope}
          syncReady={syncReady}
          ready={ready}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onStatusChange={() =>
            notifyGraphActivity?.("updated task status from board")
          }
          lastAgentActivity={lastAgentActivity}
          lastGraphActivity={lastGraphActivity}
        />
      )}

      <div className="space-y-2">
        <DemoAgentPushHint scope={scope} />
        <p className="text-xs text-violet-800/80 dark:text-violet-200/80">
          想体验任务同步：终端运行{" "}
          <code className="rounded bg-violet-100/80 px-1 font-mono dark:bg-violet-950">
            npm run task:seed
          </code>
          ，在「任务看板」里查看；也可用{" "}
          <code className="rounded bg-violet-100/80 px-1 font-mono dark:bg-violet-950">
            agent:push --task-title &quot;…&quot; --status in_progress
          </code>{" "}
          模拟 Agent 改状态。
        </p>
      </div>
    </section>
  );
}
