import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_AGENT_GRAPH_POLICY,
  isTaskStatus,
  parseTaskData,
  type MemoryNode,
  type TaskStatus,
} from "@slisync/sync-schema";

const BASE_NODE: Omit<MemoryNode, "kind" | "data" | "title"> = {
  id: "task-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "actor",
  updatedBy: "actor",
  tags: [],
  refs: [],
};

function taskNode(
  data: Record<string, unknown>,
  overrides: Partial<MemoryNode> = {},
): MemoryNode {
  return {
    ...BASE_NODE,
    kind: "task",
    title: "Example task",
    data,
    ...overrides,
  };
}

describe("isTaskStatus", () => {
  it("accepts all lifecycle values", () => {
    const statuses: TaskStatus[] = [
      "todo",
      "in_progress",
      "blocked",
      "done",
      "cancelled",
    ];
    for (const status of statuses) {
      assert.equal(isTaskStatus(status), true);
    }
  });

  it("rejects unknown strings", () => {
    assert.equal(isTaskStatus("open"), false);
    assert.equal(isTaskStatus(1), false);
  });
});

describe("parseTaskData", () => {
  it("parses a valid task node with optional fields", () => {
    const parsed = parseTaskData(
      taskNode({
        scope: { workspaceId: "ws-demo", sessionId: "sess-demo" },
        status: "in_progress",
        assigneeId: "user-42",
        priority: 2,
        dueAt: "2026-06-01T12:00:00.000Z",
        source: "agent:push",
      }),
    );
    assert.deepEqual(parsed, {
      scope: { workspaceId: "ws-demo", sessionId: "sess-demo" },
      status: "in_progress",
      assigneeId: "user-42",
      priority: 2,
      dueAt: "2026-06-01T12:00:00.000Z",
      source: "agent:push",
    });
  });

  it("parses minimal task data (scope + status only)", () => {
    const parsed = parseTaskData(
      taskNode({
        scope: { workspaceId: "ws-1" },
        status: "todo",
      }),
    );
    assert.deepEqual(parsed, {
      scope: { workspaceId: "ws-1" },
      status: "todo",
    });
  });

  it("returns null for non-task kinds", () => {
    const node: MemoryNode = {
      ...BASE_NODE,
      kind: "memory_chunk",
      title: "chunk",
      data: {
        scope: { workspaceId: "ws-1" },
        content: "hello",
      },
    };
    assert.equal(parseTaskData(node), null);
  });

  it("returns null when scope or status is invalid", () => {
    assert.equal(
      parseTaskData(taskNode({ scope: { workspaceId: "" }, status: "todo" })),
      null,
    );
    assert.equal(
      parseTaskData(taskNode({ scope: { workspaceId: "ws-1" }, status: "open" })),
      null,
    );
    assert.equal(parseTaskData(taskNode({ status: "todo" })), null);
    assert.equal(parseTaskData(taskNode({})), null);
  });

  it("returns null when optional fields have wrong types", () => {
    assert.equal(
      parseTaskData(
        taskNode({
          scope: { workspaceId: "ws-1" },
          status: "done",
          assigneeId: 99,
        }),
      ),
      null,
    );
    assert.equal(
      parseTaskData(
        taskNode({
          scope: { workspaceId: "ws-1" },
          status: "done",
          priority: "high",
        }),
      ),
      null,
    );
  });
});

describe("DEFAULT_AGENT_GRAPH_POLICY (task bus Phase 0)", () => {
  it("allows task nodes and task edge relations by default", () => {
    assert.ok(DEFAULT_AGENT_GRAPH_POLICY.allowedNodeKinds.includes("task"));
    assert.ok(
      DEFAULT_AGENT_GRAPH_POLICY.allowedRelations.includes("depends_on"),
    );
    assert.ok(
      DEFAULT_AGENT_GRAPH_POLICY.allowedRelations.includes("assigned_to"),
    );
  });
});
