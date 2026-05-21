"use client";

import {
  parseMemoryChunkData,
  parseSessionScope,
  parseWorkspaceId,
  type MemoryNode,
} from "@slisync/sync-schema";

type Props = {
  node: MemoryNode | null;
};

export function GraphNodeDetail({ node }: Props) {
  if (!node) {
    return (
      <p className="text-xs text-zinc-500">
        点击图中节点查看详情（kind、scope、chunk 内容等）。
      </p>
    );
  }

  const chunk = parseMemoryChunkData(node);
  const sessionScope = parseSessionScope(node);
  const workspaceId = parseWorkspaceId(node);

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white/60 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {node.kind}
        </span>
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          {node.title}
        </span>
      </div>
      <p className="font-mono text-[10px] text-zinc-400">{node.id}</p>
      {node.body ? (
        <p className="text-zinc-600 dark:text-zinc-400">{node.body}</p>
      ) : null}
      {workspaceId ? (
        <p>
          <span className="text-zinc-500">workspaceId</span>{" "}
          <code>{workspaceId}</code>
        </p>
      ) : null}
      {sessionScope ? (
        <p>
          <span className="text-zinc-500">scope</span>{" "}
          <code>
            {sessionScope.workspaceId}
            {sessionScope.sessionId ? ` / ${sessionScope.sessionId}` : ""}
          </code>
        </p>
      ) : null}
      {chunk ? (
        <div className="rounded bg-violet-50/80 p-2 dark:bg-violet-950/30">
          <p className="text-[10px] font-medium uppercase text-violet-600 dark:text-violet-400">
            chunk
          </p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {chunk.content}
          </p>
          {chunk.source ? (
            <p className="mt-1 text-zinc-500">source: {chunk.source}</p>
          ) : null}
        </div>
      ) : null}
      {node.tags.length > 0 ? (
        <p className="flex flex-wrap gap-1">
          {node.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[10px] dark:border-zinc-600"
            >
              {t}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
