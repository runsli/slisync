/**
 * Phase 6: simulate an AI agent pushing shared memory or graph tasks.
 *
 * Usage:
 *   npm run agent:push
 *   npm run agent:push -- --action summarize --append " [from agent]"
 *   npm run agent:push -- --task-title "Review export" --status in_progress
 *   SYNC_URL=http://localhost:3001 npm run agent:push
 */
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
import { isTaskStatus, type TaskStatus } from "@slisync/sync-schema";
import { buildTaskUpsertOps } from "@slisync/sync-sdk/graph";

const ROOM_ID = process.env.SYNC_ROOM ?? "example-room";
const AGENT_ID = process.env.SYNC_AGENT_ID ?? "example-agent";
const SYNC_URL =
  process.env.SYNC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SYNC_URL?.trim() ||
  "http://127.0.0.1:3000";
const DEMO_WORKSPACE_ID = "ws-demo";
const DEMO_SESSION_ID = "sess-demo";

const CLI_TASK_STATUSES = new Set<TaskStatus>([
  "todo",
  "in_progress",
  "done",
]);

function parseArgs(argv: string[]) {
  let action = "annotate";
  let append: string | undefined;
  let message: string | undefined;
  let counterDelta: number | undefined;
  let taskTitle: string | undefined;
  let taskStatus: TaskStatus | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--action" && argv[i + 1]) {
      action = argv[++i]!;
      continue;
    }
    if (arg === "--append" && argv[i + 1]) {
      append = argv[++i];
      continue;
    }
    if (arg === "--message" && argv[i + 1]) {
      message = argv[++i];
      continue;
    }
    if (arg === "--counter" && argv[i + 1]) {
      counterDelta = Number(argv[++i]);
      continue;
    }
    if (arg === "--task-title" && argv[i + 1]) {
      taskTitle = argv[++i];
      continue;
    }
    if (arg === "--status" && argv[i + 1]) {
      const raw = argv[++i]!;
      if (!CLI_TASK_STATUSES.has(raw as TaskStatus) || !isTaskStatus(raw)) {
        console.error(
          `[agent:push] invalid --status "${raw}" (use todo|in_progress|done)`,
        );
        process.exit(1);
      }
      taskStatus = raw as TaskStatus;
      continue;
    }
  }

  return { action, append, message, counterDelta, taskTitle, taskStatus };
}

async function main() {
  const { action, append, message, counterDelta, taskTitle, taskStatus } =
    parseArgs(process.argv.slice(2));

  if (taskTitle !== undefined || taskStatus !== undefined) {
    if (!taskTitle || !taskStatus) {
      console.error(
        "[agent:push] --task-title and --status must be used together",
      );
      process.exit(1);
    }

    const graphOps = buildTaskUpsertOps(AGENT_ID, {
      workspaceId: DEMO_WORKSPACE_ID,
      sessionId: DEMO_SESSION_ID,
      title: taskTitle,
      status: taskStatus,
      source: "agent:push",
    });

    const ack = await pushAgentMemory({
      url: SYNC_URL,
      roomId: ROOM_ID,
      agentId: AGENT_ID,
      action: action === "annotate" ? "update_task" : action,
      graphOps,
    });

    if (!ack.ok) {
      console.error("[agent:push] failed:", ack.error ?? "unknown");
      process.exit(1);
    }

    console.log(
      `[agent:push] ok room=${ROOM_ID} task="${taskTitle}" status=${taskStatus} v=${ack.version} ${ack.entry?.summary ?? ""}`,
    );
    return;
  }

  const memory: {
    message?: string;
    appendToMessage?: string;
    counterDelta?: number;
  } = {};
  if (message !== undefined) memory.message = message;
  if (append !== undefined) memory.appendToMessage = append;
  if (counterDelta !== undefined && !Number.isNaN(counterDelta)) {
    memory.counterDelta = counterDelta;
  }
  if (Object.keys(memory).length === 0) {
    memory.appendToMessage = " [from agent]";
  }

  const ack = await pushAgentMemory({
    url: SYNC_URL,
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    action,
    memory,
  });

  if (!ack.ok) {
    console.error("[agent:push] failed:", ack.error ?? "unknown");
    process.exit(1);
  }

  console.log(
    `[agent:push] ok room=${ROOM_ID} v=${ack.version} ${ack.entry?.summary ?? ""}`,
  );
}

main().catch((err) => {
  console.error("[agent:push] error:", err);
  process.exit(1);
});
