"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearLocalRoom,
  createSyncStore,
  getSyncEndpoint,
  useSync,
  type SyncStrategy,
} from "@slisync/sync-sdk";
import { ScopedMemoryDemo } from "./ScopedMemoryDemo";
import { SyncStrategyPanel } from "./SyncStrategyPanel";
import { SYNC_PROTOCOL_VERSION } from "@slisync/sync-sdk";

const ROOM_ID = "example-room";

const initialState = {
  message: "Hello from shared memory",
  counter: 0,
  agentLog: [] as {
    agentId: string;
    action: string;
    summary: string;
    at: number;
  }[],
};

const STRATEGIES: { id: SyncStrategy; label: string; hint: string }[] = [
  {
    id: "crdt",
    label: "CRDT",
    hint: "Yjs 自动合并并发编辑，无版本冲突提示",
  },
  {
    id: "lww",
    label: "LWW",
    hint: "LWW：baseVersion 乐观锁，落后写入触发冲突并回退",
  },
];

const STANDALONE_SYNC_HINT =
  typeof process.env.NEXT_PUBLIC_SYNC_URL === "string" &&
  process.env.NEXT_PUBLIC_SYNC_URL.length > 0;

function statusColor(status: string) {
  switch (status) {
    case "connected":
      return "bg-emerald-500";
    case "reconnecting":
    case "connecting":
      return "bg-amber-500";
    default:
      return "bg-zinc-400";
  }
}

function conflictLabel(reason: string) {
  switch (reason) {
    case "stale_version":
      return "版本冲突：已同步服务端最新状态（LWW）";
    case "invalid_patch":
      return "补丁无效：已回退到服务端状态";
    default:
      return "同步冲突已解决";
  }
}

export function SyncDemo() {
  const [strategy, setStrategy] = useState<SyncStrategy>("crdt");
  const syncStore = useMemo(() => createSyncStore(initialState), [strategy]);

  const {
    data,
    version,
    status,
    clientId,
    lastConflict,
    connectionError,
    lastAgentActivity,
    lastGraphActivity,
    presenceMembers,
    outboxSize,
    localRestored,
    lastSyncedAt,
    notifyGraphActivity,
    patchData,
    mounted,
    syncReady,
    getCrdtDocument,
  } = useSync({
    roomId: ROOM_ID,
    defaultState: initialState,
    strategy,
    store: syncStore,
  });

  const [syncEndpoint, setSyncEndpoint] = useState("");
  const [localCacheNotice, setLocalCacheNotice] = useState<string | null>(null);
  useEffect(() => {
    if (mounted) setSyncEndpoint(getSyncEndpoint());
  }, [mounted]);

  useEffect(() => {
    if (!lastAgentActivity) return;
    const timer = setTimeout(() => {
      syncStore.getState().setLastAgentActivity(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [syncStore, lastAgentActivity?.entry.at]);

  useEffect(() => {
    if (!lastGraphActivity) return;
    const timer = setTimeout(() => {
      syncStore.getState().setLastGraphActivity(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [syncStore, lastGraphActivity?.at]);

  const activeHint = STRATEGIES.find((s) => s.id === strategy)?.hint ?? "";
  const canEditCounter = strategy === "crdt" ? syncReady : mounted;
  const displayMessage = mounted ? data.message : initialState.message;
  const displayStatus = mounted ? status : "disconnected";
  const displayVersion = mounted ? version : 0;

  const localRestoreLabel =
    localRestored === null
      ? "检测本地缓存…"
      : localRestored
        ? "已从本地恢复"
        : "无本地数据";

  const lastSyncedLabel =
    lastSyncedAt != null
      ? new Date(lastSyncedAt).toLocaleString()
      : "尚未与服务端同步";

  async function handleClearLocalCache() {
    try {
      await clearLocalRoom(ROOM_ID);
      syncStore.getState().setLocalRestored(false);
      syncStore.getState().setLastSyncedAt(null);
      setLocalCacheNotice("已清除本 room 的本地缓存（IndexedDB）");
    } catch (err) {
      const message = err instanceof Error ? err.message : "清除失败";
      setLocalCacheNotice(message);
    }
    setTimeout(() => setLocalCacheNotice(null), 4000);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Slisync · 共享记忆 Demo
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          workspace → session → memory_chunk · 多窗口与 Agent 在同一 room
          内实时共编结构化记忆
        </p>
      </header>

      {mounted && connectionError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          连接失败: {connectionError}
          <br />
          <span className="text-xs opacity-80">
            端点: {syncEndpoint || "—"} · 请用终端打印的 LAN 地址打开页面
          </span>
        </div>
      ) : null}

      {lastAgentActivity ? (
        <div
          role="status"
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200"
        >
          Agent <span className="font-medium">{lastAgentActivity.entry.agentId}</span>{" "}
          · {lastAgentActivity.entry.action}: {lastAgentActivity.entry.summary}
        </div>
      ) : null}

      {lastGraphActivity ? (
        <div
          role="status"
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200"
        >
          Graph{" "}
          <span className="font-medium">{lastGraphActivity.actorId}</span>
          {lastGraphActivity.source ? ` (${lastGraphActivity.source})` : null}:{" "}
          {lastGraphActivity.summary}
        </div>
      ) : null}

      {lastConflict ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {conflictLabel(lastConflict.reason)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor(displayStatus)}`}
        />
        <span className="font-medium capitalize">{displayStatus}</span>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {strategy}
        </span>
        <span className="text-zinc-400">· v{displayVersion}</span>
        {strategy === "crdt" && mounted && !syncReady ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            同步中…
          </span>
        ) : null}
        {strategy === "crdt" && outboxSize > 0 ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            离线队列 {outboxSize}
          </span>
        ) : null}
      </div>

      {strategy === "crdt" && mounted && presenceMembers.length > 0 ? (
        <section className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="w-full text-xs font-medium uppercase tracking-wide text-zinc-500">
            在线成员
          </p>
          {presenceMembers.map((m) => (
            <span
              key={m.clientId}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-700"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  m.status === "online" ? "bg-emerald-500" : "bg-zinc-400"
                }`}
              />
              {m.actorId.slice(0, 8)}
            </span>
          ))}
        </section>
      ) : null}

      {strategy === "crdt" && mounted ? (
        <ScopedMemoryDemo
          graphId={ROOM_ID}
          actorId={clientId || "anonymous"}
          syncReady={syncReady}
          getCrdtDocument={getCrdtDocument}
          notifyGraphActivity={notifyGraphActivity}
        />
      ) : null}

      {strategy === "crdt" && mounted ? (
        <section className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900/50 dark:bg-teal-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800 dark:text-teal-200">
            Local-first（CRDT）
          </p>
          <p className="text-sm text-teal-900 dark:text-teal-100">
            刷新不丢当前 room 的 Graph 与 memory_chunk：先从 IndexedDB 恢复，再与服务端
            CRDT 合并同步。
          </p>
          <dl className="grid gap-1 text-xs text-teal-900/90 dark:text-teal-100/90 sm:grid-cols-2">
            <div>
              <dt className="text-teal-700/80 dark:text-teal-300/80">本地状态</dt>
              <dd className="font-medium">{localRestoreLabel}</dd>
            </div>
            <div>
              <dt className="text-teal-700/80 dark:text-teal-300/80">离线队列</dt>
              <dd className="font-medium">{outboxSize}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-teal-700/80 dark:text-teal-300/80">上次同步</dt>
              <dd className="font-medium">{lastSyncedLabel}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-sm text-teal-900 hover:bg-teal-50 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100 dark:hover:bg-teal-900"
            onClick={() => void handleClearLocalCache()}
          >
            清除本 room 本地缓存
          </button>
          {localCacheNotice ? (
            <p className="text-xs text-teal-800 dark:text-teal-200" role="status">
              {localCacheNotice}
            </p>
          ) : null}
        </section>
      ) : null}

      <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          旧版共享字段演示（message / counter）
        </summary>
        <div className="flex flex-col gap-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <section className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Message
            </label>
            <input
              suppressHydrationWarning
              name="shared-memory-message"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700"
              value={displayMessage}
              readOnly={!mounted}
              onChange={(e) =>
                patchData({ message: e.target.value }, { debounceMs: 300 })
              }
              placeholder="Type to sync across windows..."
            />
          </section>

          <section className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Counter</p>
              <p className="text-3xl font-semibold tabular-nums">
                {mounted ? data.counter : initialState.counter}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canEditCounter}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
                onClick={() => patchData({ counter: data.counter - 1 })}
              >
                −
              </button>
              <button
                type="button"
                disabled={!canEditCounter}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                onClick={() => patchData({ counter: data.counter + 1 })}
              >
                +
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Agent 活动日志
              </p>
              <code className="text-[10px] text-zinc-400">npm run agent:push</code>
            </div>
            {mounted && (data.agentLog?.length ?? 0) > 0 ? (
              <ul className="max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-400">
                {[...(data.agentLog ?? [])].reverse().map((entry) => (
                  <li
                    key={entry.at}
                    className="rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900/60"
                  >
                    <span className="font-medium text-violet-700 dark:text-violet-300">
                      {entry.agentId}
                    </span>{" "}
                    · {entry.action} — {entry.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">
                另开终端运行{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  npm run agent:push -- --action summarize --append &quot;
                  [from agent]&quot;
                </code>
                ，本页会收到 agent 写入并显示活动条。
              </p>
            )}
          </section>
        </div>
      </details>

      {mounted ? (
        <SyncStrategyPanel
          strategy={strategy}
          syncEndpoint={syncEndpoint}
          protocolVersion={SYNC_PROTOCOL_VERSION}
          syncReady={syncReady}
          outboxSize={outboxSize}
          presenceCount={presenceMembers.length}
        />
      ) : null}

      <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          高级：LWW 对比实验
        </summary>
        <div className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">{activeHint}</p>
          <div
            className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700"
            role="group"
            aria-label="同步策略"
          >
            {STRATEGIES.map((item) => {
              const active = strategy === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStrategy(item.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {strategy === "lww" ? (
            <p className="text-xs text-zinc-500">
              试 LWW：A 窗口离线改文案 → B 窗口修改并同步 → A
              恢复网络再编辑，应出现黄色冲突条且内容回退为 B 的版本。展开上方「旧版共享字段演示」编辑
              Message。
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              主路径使用 CRDT + Memory Graph。切换至 LWW 后 Graph 面板会隐藏，仅保留
              message/counter 补丁同步实验。
            </p>
          )}
        </div>
      </details>

      {mounted && clientId ? (
        <footer className="space-y-1 break-all text-xs text-zinc-400">
          {STANDALONE_SYNC_HINT ? (
            <p>独立 sync server · {process.env.NEXT_PUBLIC_SYNC_URL}</p>
          ) : null}
          <p>clientId: {clientId}</p>
        </footer>
      ) : null}
    </div>
  );
}
