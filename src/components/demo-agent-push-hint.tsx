"use client";

import { useState } from "react";
import type { MemoryScope } from "@slisync/sync-schema";

/** CLI command aligned with Demo default scope (ws-demo / sess-demo). */
export const DEMO_AGENT_PUSH_COMMAND =
  'npm run agent:push -- --action summarize --append " [from agent]"';

type Props = {
  scope: MemoryScope;
  compact?: boolean;
};

/** Copyable agent:push hint; graph:seed uses the same workspace/session ids. */
export function DemoAgentPushHint({ scope, compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(DEMO_AGENT_PUSH_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (compact) {
    return (
      <p className="text-xs text-zinc-500">
        让终端里的 Agent 写入同一份记忆（与{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">graph:seed</code>
        同一项目/会话）：
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] text-violet-800 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200"
        >
          {copied ? "已复制" : "复制命令"}
        </button>
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-3 text-xs dark:border-violet-900/50 dark:bg-violet-950/30">
      <p className="mb-1.5 text-violet-900 dark:text-violet-100">
        在终端运行下面命令，模拟另一个 Agent 往当前项目记忆里追加内容（与{" "}
        <code className="rounded bg-violet-100/80 px-1 dark:bg-violet-900">graph:seed</code>{" "}
        使用同一工作区
        <span className="font-medium"> {scope.workspaceId}</span>
        {scope.sessionId ? (
          <>
            {" "}
            / 会话 <span className="font-medium">{scope.sessionId}</span>
          </>
        ) : null}
        ）
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-violet-900 dark:bg-zinc-900 dark:text-violet-100">
          {DEMO_AGENT_PUSH_COMMAND}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded-lg border border-violet-300 bg-white px-2 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}
