/**
 * Phase 6: simulate an AI agent pushing shared memory.
 *
 * Usage:
 *   npm run agent:push
 *   npm run agent:push -- --action summarize --append " [from agent]"
 *   SYNC_URL=http://localhost:3001 npm run agent:push
 */
import { pushAgentMemory } from "@slisync/sync-sdk/agent";

const ROOM_ID = process.env.SYNC_ROOM ?? "example-room";
const AGENT_ID = process.env.SYNC_AGENT_ID ?? "example-agent";
const SYNC_URL = process.env.SYNC_URL ?? process.env.NEXT_PUBLIC_SYNC_URL;

function parseArgs(argv: string[]) {
  let action = "annotate";
  let append: string | undefined;
  let message: string | undefined;
  let counterDelta: number | undefined;

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
  }

  return { action, append, message, counterDelta };
}

async function main() {
  const { action, append, message, counterDelta } = parseArgs(
    process.argv.slice(2),
  );

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
