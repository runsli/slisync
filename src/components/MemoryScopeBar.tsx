"use client";

import { useMemo } from "react";
import {
  parseSessionScope,
  parseWorkspaceId,
  type MemoryNode,
  type MemoryScope,
} from "@slisync/sync-schema";

export type MemoryScopeBarProps = {
  scope: MemoryScope;
  nodes: MemoryNode[];
  onScopeChange: (scope: MemoryScope) => void;
};

/** Workspace / session picker driven by graph snapshot nodes. */
export function MemoryScopeBar({
  scope,
  nodes,
  onScopeChange,
}: MemoryScopeBarProps) {
  const activeNodes = useMemo(
    () => nodes.filter((n) => !n.deletedAt),
    [nodes],
  );

  const workspaceOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { workspaceId: string; label: string }[] = [];
    for (const node of activeNodes) {
      if (node.kind !== "workspace") continue;
      const workspaceId = parseWorkspaceId(node);
      if (!workspaceId || seen.has(workspaceId)) continue;
      seen.add(workspaceId);
      options.push({ workspaceId, label: node.title || workspaceId });
    }
    if (!seen.has(scope.workspaceId)) {
      options.unshift({
        workspaceId: scope.workspaceId,
        label: scope.workspaceId,
      });
    }
    return options;
  }, [activeNodes, scope.workspaceId]);

  const sessionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { sessionId: string; label: string }[] = [];
    for (const node of activeNodes) {
      if (node.kind !== "session") continue;
      const sessionScope = parseSessionScope(node);
      if (!sessionScope || sessionScope.workspaceId !== scope.workspaceId) {
        continue;
      }
      const sessionId = sessionScope.sessionId ?? node.id;
      if (seen.has(sessionId)) continue;
      seen.add(sessionId);
      options.push({ sessionId, label: node.title || sessionId });
    }
    if (scope.sessionId && !seen.has(scope.sessionId)) {
      options.unshift({
        sessionId: scope.sessionId,
        label: scope.sessionId,
      });
    }
    return options;
  }, [activeNodes, scope.workspaceId, scope.sessionId]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1 text-zinc-500">
          <span>工作区</span>
          <select
            className="min-w-[8rem] rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            value={scope.workspaceId}
            onChange={(e) =>
              onScopeChange({
                workspaceId: e.target.value,
                sessionId: scope.sessionId,
              })
            }
          >
            {workspaceOptions.map((opt) => (
              <option key={opt.workspaceId} value={opt.workspaceId}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-zinc-500">
          <span>会话</span>
          <select
            className="min-w-[8rem] rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            value={scope.sessionId ?? ""}
            onChange={(e) =>
              onScopeChange({
                workspaceId: scope.workspaceId,
                sessionId: e.target.value || undefined,
              })
            }
          >
            <option value="">（未指定 session）</option>
            {sessionOptions.map((opt) => (
              <option key={opt.sessionId} value={opt.sessionId}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
          自定义 workspace / session ID
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex items-center gap-1">
            workspace
            <input
              className="w-28 rounded border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-700"
              value={scope.workspaceId}
              onChange={(e) =>
                onScopeChange({
                  ...scope,
                  workspaceId: e.target.value,
                })
              }
            />
          </label>
          <label className="flex items-center gap-1">
            session
            <input
              className="w-28 rounded border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-700"
              value={scope.sessionId ?? ""}
              onChange={(e) =>
                onScopeChange({
                  ...scope,
                  sessionId: e.target.value || undefined,
                })
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}
