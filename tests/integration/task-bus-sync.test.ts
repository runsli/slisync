import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as Y from "yjs";
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import {
  buildTaskUpsertOps,
  filterTasksByScope,
  MemoryGraph,
} from "@slisync/sync-sdk/graph";
import { parseTaskData } from "@slisync/sync-schema";
import type { MemoryGraphSnapshot } from "@slisync/sync-schema";
import { SYNC_EVENTS } from "@slisync/sync-sdk/protocol";
import { createCrdtRoomClient, type CrdtRoomClient } from "./helpers/crdt-room-client";
import { uniqueRoom } from "./helpers/sync-test-utils";
import { startTestSyncServer } from "./helpers/test-server";

const WORKSPACE_ID = "ws-task-test";
const SESSION_ID = "sess-task-test";
const TASK_TITLE = "Task bus integration test";

function emitCrdtUpdate(client: CrdtRoomClient) {
  const update = encodeUpdate(Y.encodeStateAsUpdate(client.doc));
  client.socket.emit(SYNC_EVENTS.CRDT_UPDATE, {
    roomId: client.roomId,
    update,
  });
}

function tasksInScope(snap: MemoryGraphSnapshot) {
  return filterTasksByScope(snap.nodes, {
    workspaceId: WORKSPACE_ID,
    sessionId: SESSION_ID,
  });
}

function taskStatus(
  snap: MemoryGraphSnapshot,
  title: string,
): string | undefined {
  const node = tasksInScope(snap).find((n) => n.title === title);
  if (!node) return undefined;
  return parseTaskData(node)?.status;
}

describe("task bus room sync", () => {
  let baseUrl = "";
  let closeServer: () => Promise<void> = async () => {};

  before(async () => {
    const server = await startTestSyncServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer();
  });

  it("A: writer upsertTask and updateTaskStatus sync to reader in same room", async () => {
    const roomId = uniqueRoom("task-writer");
    const writer = createCrdtRoomClient({ baseUrl, roomId });
    const reader = createCrdtRoomClient({ baseUrl, roomId });

    try {
      await writer.join();
      await reader.join();

      const graph = MemoryGraph.on(writer.doc, "writer").init(roomId);
      const task = graph.upsertTask({
        workspaceId: WORKSPACE_ID,
        sessionId: SESSION_ID,
        title: TASK_TITLE,
        status: "todo",
        source: "integration",
      });
      emitCrdtUpdate(writer);

      await reader.waitForGraph(
        (snap) => taskStatus(snap, TASK_TITLE) === "todo",
      );

      const snapTodo = MemoryGraph.on(reader.doc, "reader").snapshot();
      assert.ok(snapTodo);
      assert.equal(taskStatus(snapTodo, TASK_TITLE), "todo");

      graph.updateTaskStatus(task.id, "in_progress");
      emitCrdtUpdate(writer);

      const snapProgress = await reader.waitForGraph(
        (snap) => taskStatus(snap, TASK_TITLE) === "in_progress",
      );
      assert.equal(taskStatus(snapProgress, TASK_TITLE), "in_progress");
      const parsed = parseTaskData(
        tasksInScope(snapProgress).find((n) => n.title === TASK_TITLE)!,
      );
      assert.equal(parsed?.scope.workspaceId, WORKSPACE_ID);
      assert.equal(parsed?.scope.sessionId, SESSION_ID);
    } finally {
      writer.close();
      reader.close();
    }
  });

  it("B: pushAgentMemory graphOps seed task visible to connected reader", async () => {
    const roomId = uniqueRoom("task-agent");
    const reader = createCrdtRoomClient({ baseUrl, roomId });
    const agentTaskTitle = "Agent pushed task";

    try {
      await reader.join();

      const ack = await pushAgentMemory({
        url: baseUrl,
        roomId,
        agentId: "task-agent",
        action: "seed_tasks",
        graphOps: buildTaskUpsertOps("task-agent", {
          workspaceId: WORKSPACE_ID,
          sessionId: SESSION_ID,
          title: agentTaskTitle,
          status: "todo",
          source: "agent:push",
        }),
      });
      assert.equal(ack.ok, true, ack.error);

      const snap = await reader.waitForGraph(
        (g) => taskStatus(g, agentTaskTitle) === "todo",
      );
      assert.equal(tasksInScope(snap).length, 1);
      assert.equal(parseTaskData(tasksInScope(snap)[0]!)?.source, "agent:push");
    } finally {
      reader.close();
    }
  });
});
