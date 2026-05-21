import type { MemoryScope } from "./memory-model";
import { isMemoryScope } from "./memory-model";
import type { MemoryNode } from "./types";

/** Lifecycle status for graph-native task nodes (`kind: "task"`). */
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

/** Stored on `task` nodes under `data`. */
export interface TaskData {
  scope: MemoryScope;
  status: TaskStatus;
  assigneeId?: string;
  priority?: number;
  dueAt?: string;
  source?: string;
}

const TASK_STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
];

/** Type guard for task lifecycle status strings. */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    (TASK_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Parse structured task payload from a graph node.
 * Returns null when the node is not a task or `data` fails validation.
 */
export function parseTaskData(node: MemoryNode): TaskData | null {
  if (node.kind !== "task") return null;
  const data = node.data;
  if (!data || typeof data !== "object") return null;

  const scope = (data as TaskData).scope;
  if (!isMemoryScope(scope)) return null;

  const status = (data as TaskData).status;
  if (!isTaskStatus(status)) return null;

  const assigneeId = (data as TaskData).assigneeId;
  if (assigneeId !== undefined && typeof assigneeId !== "string") {
    return null;
  }

  const priority = (data as TaskData).priority;
  if (priority !== undefined && typeof priority !== "number") {
    return null;
  }

  const dueAt = (data as TaskData).dueAt;
  if (dueAt !== undefined && typeof dueAt !== "string") {
    return null;
  }

  const source = (data as TaskData).source;
  if (source !== undefined && typeof source !== "string") {
    return null;
  }

  return {
    scope,
    status,
    ...(assigneeId !== undefined ? { assigneeId } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(dueAt !== undefined ? { dueAt } : {}),
    ...(source !== undefined ? { source } : {}),
  };
}
