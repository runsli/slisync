import {
  edgeIdFor,
  parseTaskData,
  type GraphOp,
  type MemoryEdge,
  type MemoryNode,
  type MemoryScope,
  type TaskData,
  type TaskStatus,
} from "@slisync/sync-schema";
import { newEntityId, nowIso } from "./graph-doc";

/** Input for creating or updating a graph-native task node. */
export type UpsertTaskInput = {
  workspaceId: string;
  sessionId?: string;
  title: string;
  status: TaskStatus;
  assigneeId?: string;
  priority?: number;
  dueAt?: string;
  source?: string;
  id?: string;
  tags?: string[];
  createdBy?: string;
};

/** Optional fields when updating task status via {@link MemoryGraph.updateTaskStatus}. */
export type UpdateTaskPatch = Partial<
  Pick<
    UpsertTaskInput,
    "title" | "assigneeId" | "priority" | "dueAt" | "source" | "tags"
  >
>;

/**
 * Build demo task graph ops for a workspace (and optional session).
 * Includes ≥3 Chinese scenario tasks and edges: contains, depends_on, assigned_to.
 */
export function buildDemoTaskOps(
  actorId: string,
  workspaceId = "ws-demo",
  sessionId = "sess-demo",
): GraphOp[] {
  const at = nowIso();
  const wsNodeId = newEntityId("node");
  const sessNodeId = newEntityId("node");
  const taskTodoId = newEntityId("node");
  const taskProgressId = newEntityId("node");
  const taskDoneId = newEntityId("node");

  const workspace: MemoryNode = {
    id: wsNodeId,
    kind: "workspace",
    title: "演示工作区",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["scope:workspace"],
    refs: [],
    data: { workspaceId },
  };

  const session: MemoryNode = {
    id: sessNodeId,
    kind: "session",
    title: "当前协作会话",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["scope:session"],
    refs: [],
    data: { workspaceId, sessionId },
  };

  const taskTodo = buildTaskNode(actorId, taskTodoId, {
    workspaceId,
    sessionId,
    title: "验收第二窗口 scoped memory 同步",
    status: "todo",
    priority: 2,
    source: "demo",
  });

  const taskProgress = buildTaskNode(actorId, taskProgressId, {
    workspaceId,
    sessionId,
    title: "实现 upsertTask 与 filterTasksByScope",
    status: "in_progress",
    assigneeId: "agent-demo",
    priority: 1,
    source: "demo",
  });

  const taskDone = buildTaskNode(actorId, taskDoneId, {
    workspaceId,
    sessionId,
    title: "定稿 TaskData 与 parseTaskData",
    status: "done",
    source: "demo",
  });

  const containsWsSession: MemoryEdge = {
    id: edgeIdFor(wsNodeId, "contains", sessNodeId),
    kind: "edge",
    relation: "contains",
    from: wsNodeId,
    to: sessNodeId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const containsSessionTodo: MemoryEdge = {
    id: edgeIdFor(sessNodeId, "contains", taskTodoId),
    kind: "edge",
    relation: "contains",
    from: sessNodeId,
    to: taskTodoId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const containsSessionProgress: MemoryEdge = {
    id: edgeIdFor(sessNodeId, "contains", taskProgressId),
    kind: "edge",
    relation: "contains",
    from: sessNodeId,
    to: taskProgressId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const containsSessionDone: MemoryEdge = {
    id: edgeIdFor(sessNodeId, "contains", taskDoneId),
    kind: "edge",
    relation: "contains",
    from: sessNodeId,
    to: taskDoneId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const dependsProgressOnDone: MemoryEdge = {
    id: edgeIdFor(taskProgressId, "depends_on", taskDoneId),
    kind: "edge",
    relation: "depends_on",
    from: taskProgressId,
    to: taskDoneId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  const assignedTodo: MemoryEdge = {
    id: edgeIdFor(taskTodoId, "assigned_to", sessNodeId),
    kind: "edge",
    relation: "assigned_to",
    from: taskTodoId,
    to: sessNodeId,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: [],
    refs: [],
    unique: true,
  };

  return [
    { op: "upsertNode", node: workspace },
    { op: "upsertNode", node: session },
    { op: "upsertNode", node: taskTodo },
    { op: "upsertNode", node: taskProgress },
    { op: "upsertNode", node: taskDone },
    { op: "upsertEdge", edge: containsWsSession },
    { op: "upsertEdge", edge: containsSessionTodo },
    { op: "upsertEdge", edge: containsSessionProgress },
    { op: "upsertEdge", edge: containsSessionDone },
    { op: "upsertEdge", edge: dependsProgressOnDone },
    { op: "upsertEdge", edge: assignedTodo },
  ];
}

function buildTaskNode(
  actorId: string,
  id: string,
  input: {
    workspaceId: string;
    sessionId?: string;
    title: string;
    status: TaskStatus;
    assigneeId?: string;
    priority?: number;
    dueAt?: string;
    source?: string;
  },
): MemoryNode {
  const at = nowIso();
  const scope: MemoryScope = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
  };
  const data: TaskData = {
    scope,
    status: input.status,
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
  };

  return {
    id,
    kind: "task",
    title: input.title,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId,
    updatedBy: actorId,
    tags: ["scope:task"],
    refs: [],
    data: data as unknown as Record<string, unknown>,
  };
}

/** Keep only non-deleted task nodes whose parsed scope matches the filter. */
export function filterTasksByScope(
  nodes: MemoryNode[],
  filter: Partial<MemoryScope>,
): MemoryNode[] {
  return nodes.filter((node) => {
    if (node.deletedAt || node.kind !== "task") return false;
    const task = parseTaskData(node);
    if (!task) return false;
    if (!filter.workspaceId && !filter.sessionId) return true;
    if (
      filter.workspaceId &&
      task.scope.workspaceId !== filter.workspaceId
    ) {
      return false;
    }
    if (filter.sessionId && task.scope.sessionId !== filter.sessionId) {
      return false;
    }
    return true;
  });
}
