import type { MemoryNode } from "./types";

/** Logical scope for AI memory chunks (workspace / session / chunk). */
export type MemoryScopeKind = "workspace" | "session" | "chunk";

export interface MemoryScope {
  workspaceId: string;
  sessionId?: string;
}

/** Stored on `memory_chunk` nodes under `data`. */
export interface MemoryChunkData {
  scope: MemoryScope;
  content: string;
  source?: string;
  importance?: number;
}

export function isMemoryScope(value: unknown): value is MemoryScope {
  if (!value || typeof value !== "object") return false;
  const s = value as MemoryScope;
  return typeof s.workspaceId === "string" && s.workspaceId.length > 0;
}

export function parseMemoryChunkData(
  node: MemoryNode,
): MemoryChunkData | null {
  if (node.kind !== "memory_chunk") return null;
  const data = node.data;
  if (!data || typeof data !== "object") return null;
  const scope = (data as MemoryChunkData).scope;
  if (!isMemoryScope(scope)) return null;
  const content = (data as MemoryChunkData).content;
  if (typeof content !== "string") return null;
  return {
    scope,
    content,
    source:
      typeof (data as MemoryChunkData).source === "string"
        ? (data as MemoryChunkData).source
        : undefined,
    importance:
      typeof (data as MemoryChunkData).importance === "number"
        ? (data as MemoryChunkData).importance
        : undefined,
  };
}

export function parseWorkspaceId(node: MemoryNode): string | null {
  if (node.kind !== "workspace") return null;
  const id = node.data?.workspaceId;
  return typeof id === "string" && id.length > 0 ? id : node.id;
}

export function parseSessionScope(node: MemoryNode): MemoryScope | null {
  if (node.kind !== "session") return null;
  const workspaceId = node.data?.workspaceId;
  const sessionId = node.data?.sessionId ?? node.id;
  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return null;
  }
  return { workspaceId, sessionId: String(sessionId) };
}

/** Match node against optional workspace/session filter. */
export function nodeMatchesMemoryScope(
  node: MemoryNode,
  filter: Partial<MemoryScope>,
): boolean {
  if (!filter.workspaceId && !filter.sessionId) return true;

  if (node.kind === "workspace") {
    const wsId = parseWorkspaceId(node);
    if (filter.workspaceId && wsId !== filter.workspaceId) return false;
    if (filter.sessionId) return false;
    return true;
  }

  if (node.kind === "session") {
    const scope = parseSessionScope(node);
    if (!scope) return false;
    if (filter.workspaceId && scope.workspaceId !== filter.workspaceId) {
      return false;
    }
    if (filter.sessionId && scope.sessionId !== filter.sessionId) {
      return false;
    }
    return true;
  }

  if (node.kind === "memory_chunk") {
    const chunk = parseMemoryChunkData(node);
    if (!chunk) return false;
    if (
      filter.workspaceId &&
      chunk.scope.workspaceId !== filter.workspaceId
    ) {
      return false;
    }
    if (filter.sessionId && chunk.scope.sessionId !== filter.sessionId) {
      return false;
    }
    return true;
  }

  return false;
}
