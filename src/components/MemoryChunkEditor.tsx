"use client";

import { useEffect, useRef, useState } from "react";
import type { MemoryGraph } from "@slisync/sync-sdk";
import {
  parseMemoryChunkData,
  parseSessionScope,
  parseWorkspaceId,
  type MemoryNode,
} from "@slisync/sync-schema";

const DEBOUNCE_MS = 300;

export type MemoryChunkEditorProps = {
  node: MemoryNode | null;
  graph: MemoryGraph | null;
  ready: boolean;
  syncReady: boolean;
  focusToken?: number;
};

/** Inline editor for memory_chunk title and content (CRDT-backed). */
export function MemoryChunkEditor({
  node,
  graph,
  ready,
  syncReady,
  focusToken = 0,
}: MemoryChunkEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!node || node.kind !== "memory_chunk") {
      setTitle("");
      setContent("");
      return;
    }
    const chunk = parseMemoryChunkData(node);
    setTitle(node.title);
    setContent(chunk?.content ?? "");
  }, [node?.id, node?.title, node?.updatedAt, node?.kind]);

  useEffect(() => {
    if (node?.kind === "memory_chunk" && focusToken > 0) {
      titleRef.current?.focus();
    }
  }, [focusToken, node?.id, node?.kind]);

  const flushPatch = (patch: { title?: string; content?: string }) => {
    if (!graph || !node || node.kind !== "memory_chunk") return;
    graph.updateChunkContent(node.id, patch);
  };

  const schedulePatch = (patch: { title?: string; content?: string }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushPatch(patch);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!syncReady) {
    return (
      <p className="text-sm text-zinc-500">正在同步，稍后即可编辑…</p>
    );
  }

  if (!node) {
    return (
      <p className="text-sm text-zinc-500">
        在左侧点一条<span className="font-medium">记忆片段</span>
        ，或点「+ 新建记忆片段」开始写。
      </p>
    );
  }

  if (node.kind !== "memory_chunk") {
    const workspaceId = parseWorkspaceId(node);
    const sessionScope = parseSessionScope(node);
    return (
      <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <p className="font-medium text-zinc-700 dark:text-zinc-200">
          已选节点：{node.kind} · {node.title}
        </p>
        <p className="text-xs text-zinc-500">
          只有「记忆片段」能改正文。请选其子级片段，或新建一条记忆片段。
        </p>
        {workspaceId ? (
          <p className="text-xs text-zinc-500">
            workspaceId: <code>{workspaceId}</code>
          </p>
        ) : null}
        {sessionScope ? (
          <p className="text-xs text-zinc-500">
            scope:{" "}
            <code>
              {sessionScope.workspaceId}
              {sessionScope.sessionId ? ` / ${sessionScope.sessionId}` : ""}
            </code>
          </p>
        ) : null}
        <p className="font-mono text-[10px] text-zinc-400">{node.id}</p>
      </div>
    );
  }

  const chunk = parseMemoryChunkData(node);
  const canEdit = ready && graph != null;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          memory_chunk
        </span>
        {chunk ? (
          <span>
            {chunk.scope.workspaceId}
            {chunk.scope.sessionId ? ` / ${chunk.scope.sessionId}` : ""}
          </span>
        ) : null}
        <span className="font-mono text-[10px] text-zinc-400">{node.id}</span>
      </div>

      <label className="space-y-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          标题
        </span>
        <input
          ref={titleRef}
          type="text"
          disabled={!canEdit}
          className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-50 dark:border-zinc-700"
          value={title}
          onChange={(e) => {
            const next = e.target.value;
            setTitle(next);
            schedulePatch({ title: next, content });
          }}
          onBlur={() => flushPatch({ title, content })}
        />
      </label>

      <label className="flex min-h-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          内容
        </span>
        <textarea
          disabled={!canEdit}
          rows={10}
          className="min-h-[12rem] w-full flex-1 resize-y rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-50 dark:border-zinc-700"
          value={content}
          onChange={(e) => {
            const next = e.target.value;
            setContent(next);
            schedulePatch({ title, content: next });
          }}
          onBlur={() => flushPatch({ title, content })}
        />
      </label>

      {chunk?.source ? (
        <p className="text-xs text-zinc-500">source: {chunk.source}</p>
      ) : null}
    </div>
  );
}
