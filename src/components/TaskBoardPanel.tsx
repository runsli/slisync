"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  filterTasksByScope,
  type AgentActivityPayload,
  type MemoryGraph,
} from "@slisync/sync-sdk";
import {
  parseTaskData,
  type GraphActivityPayload,
  type MemoryGraphSnapshot,
  type MemoryScope,
  type MemoryNode,
  type TaskStatus,
} from "@slisync/sync-schema";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待办",
  in_progress: "进行中",
  blocked: "阻塞",
  done: "已完成",
  cancelled: "已取消",
};

const COLUMN_ORDER: {
  key: string;
  title: string;
  statuses: TaskStatus[];
}[] = [
  { key: "todo", title: "待办", statuses: ["todo", "blocked"] },
  { key: "progress", title: "进行中", statuses: ["in_progress"] },
  { key: "done", title: "已完成", statuses: ["done"] },
];

export type TaskBoardPanelProps = {
  graph: MemoryGraph | null;
  snapshot: MemoryGraphSnapshot | null;
  scope: MemoryScope;
  syncReady: boolean;
  ready: boolean;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onStatusChange?: () => void;
  lastAgentActivity?: AgentActivityPayload | null;
  lastGraphActivity?: GraphActivityPayload | null;
};

function isTaskRelatedAgentActivity(
  activity: AgentActivityPayload | null | undefined,
): boolean {
  if (!activity) return false;
  const { action, summary } = activity.entry;
  return (
    action.includes("task") ||
    /task|任务|seed_tasks|update_task/i.test(summary)
  );
}

const DEMO_TASK_SUMMARY_HINTS = [
  "upsertTask",
  "parseTaskData",
  "scoped memory",
  "验收",
  "实现",
  "定稿",
];

function isTaskRelatedGraphSummary(summary: string): boolean {
  if (/\btask\b/i.test(summary) || summary.includes("任务")) return true;
  return DEMO_TASK_SUMMARY_HINTS.some((hint) => summary.includes(hint));
}

/** Kanban-style task board for scoped graph tasks (CRDT-backed). */
export function TaskBoardPanel({
  graph,
  snapshot,
  scope,
  syncReady,
  ready,
  selectedTaskId,
  onSelectTask,
  onStatusChange,
  lastAgentActivity = null,
  lastGraphActivity = null,
}: TaskBoardPanelProps) {
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const tasks = useMemo(() => {
    const nodes = filterTasksByScope(snapshot?.nodes ?? [], scope);
    return nodes
      .map((node) => {
        const data = parseTaskData(node);
        return data ? { node, data } : null;
      })
      .filter((row): row is { node: MemoryNode; data: NonNullable<ReturnType<typeof parseTaskData>> } =>
        row !== null,
      );
  }, [snapshot?.nodes, scope]);

  const tasksByColumn = useMemo(() => {
    const cancelled = tasks.filter((t) => t.data.status === "cancelled");
    const columns = COLUMN_ORDER.map((col) => ({
      ...col,
      items: tasks.filter((t) => col.statuses.includes(t.data.status)),
    }));
    return { columns, cancelled };
  }, [tasks]);

  const selected = tasks.find((t) => t.node.id === selectedTaskId) ?? null;

  useEffect(() => {
    if (!selectedTaskId) return;
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedTaskId, snapshot?.nodes]);

  const showActivity =
    isTaskRelatedAgentActivity(lastAgentActivity) ||
    (lastGraphActivity && isTaskRelatedGraphSummary(lastGraphActivity.summary));

  const handleStatusChange = (nodeId: string, status: TaskStatus) => {
    if (!graph || !syncReady) return;
    graph.updateTaskStatus(nodeId, status);
    onStatusChange?.();
  };

  if (!syncReady) {
    return (
      <p className="text-sm text-zinc-500">正在同步任务，请稍候…</p>
    );
  }

  if (!ready) {
    return <p className="text-sm text-zinc-500">加载任务图…</p>;
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/40 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-950/90 dark:text-amber-100/90">
          当前项目下还没有任务
        </p>
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
          在终端运行{" "}
          <code className="rounded bg-white/80 px-1 font-mono dark:bg-zinc-900">
            npm run task:seed
          </code>{" "}
          可填入演示待办（需已运行 <code className="font-mono">npm run dev</code>）
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showActivity ? (
        <div
          role="status"
          className="rounded-lg border border-amber-400/80 bg-amber-100/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <span className="font-medium">任务有更新</span>
          {lastAgentActivity && isTaskRelatedAgentActivity(lastAgentActivity) ? (
            <p className="mt-1 text-xs opacity-90">
              {lastAgentActivity.entry.agentId} · {lastAgentActivity.entry.action}:{" "}
              {lastAgentActivity.entry.summary}
            </p>
          ) : null}
          {lastGraphActivity &&
          isTaskRelatedGraphSummary(lastGraphActivity.summary) ? (
            <p className="mt-1 text-xs opacity-90">
              {lastGraphActivity.actorId}
              {lastGraphActivity.source === "agent" ? "（Agent）" : "（用户）"}：{" "}
              {lastGraphActivity.summary}
            </p>
          ) : null}
          <p className="mt-1 text-xs opacity-75">
            看板会自动刷新；若未高亮对应卡片，请根据上方摘要手动点选任务。
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {tasksByColumn.columns.map((column) => (
          <div
            key={column.key}
            className="flex min-h-[10rem] flex-col rounded-lg border border-amber-200/70 bg-white/60 dark:border-amber-900/40 dark:bg-zinc-950/40"
          >
            <div className="border-b border-amber-200/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-900/50 dark:text-amber-100">
              {column.title}
              <span className="ml-1.5 font-normal text-amber-800/70 dark:text-amber-200/70">
                ({column.items.length})
              </span>
            </div>
            <ul className="flex flex-1 flex-col gap-2 p-2">
              {column.items.length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-zinc-400">暂无</li>
              ) : (
                column.items.map(({ node, data }) => {
                  const isSelected = node.id === selectedTaskId;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        id={`task-card-${node.id}`}
                        onClick={() => onSelectTask(node.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? "border-amber-500 bg-amber-50 ring-1 ring-amber-400/50 dark:border-amber-600 dark:bg-amber-950/60"
                            : "border-zinc-200 bg-white hover:border-amber-300 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-amber-800"
                        }`}
                      >
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {node.title}
                        </span>
                        {data.status === "blocked" ? (
                          <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-300">
                            阻塞
                          </span>
                        ) : null}
                        {data.assigneeId ? (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            负责人 {data.assigneeId}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ))}
      </div>

      {tasksByColumn.cancelled.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            已取消 ({tasksByColumn.cancelled.length})
          </p>
          <ul className="flex flex-wrap gap-2">
            {tasksByColumn.cancelled.map(({ node }) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelectTask(node.id)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    node.id === selectedTaskId
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/50"
                      : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                  }`}
                >
                  {node.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        ref={selectedRef}
        className="rounded-lg border border-amber-200/80 bg-white/70 p-4 dark:border-amber-900/50 dark:bg-zinc-950/50"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/80">
          任务详情
        </p>
        {selected ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {selected.node.title}
            </h3>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">状态</dt>
                <dd>
                  <select
                    className="mt-0.5 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    value={selected.data.status}
                    disabled={!graph}
                    onChange={(e) =>
                      handleStatusChange(
                        selected.node.id,
                        e.target.value as TaskStatus,
                      )
                    }
                  >
                    {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Scope</dt>
                <dd className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  {selected.data.scope.workspaceId}
                  {selected.data.scope.sessionId
                    ? ` / ${selected.data.scope.sessionId}`
                    : ""}
                </dd>
              </div>
              {selected.data.assigneeId ? (
                <div>
                  <dt className="text-zinc-500">负责人</dt>
                  <dd>{selected.data.assigneeId}</dd>
                </div>
              ) : null}
              {selected.data.priority !== undefined ? (
                <div>
                  <dt className="text-zinc-500">优先级</dt>
                  <dd>{selected.data.priority}</dd>
                </div>
              ) : null}
              {selected.data.source ? (
                <div>
                  <dt className="text-zinc-500">来源</dt>
                  <dd>{selected.data.source}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-zinc-500">
              改状态会同步到其它窗口；Agent 也可用{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                npm run agent:push -- --task-title &quot;…&quot; --status in_progress
              </code>
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">点击上方卡片查看详情并修改状态</p>
        )}
      </div>
    </div>
  );
}
