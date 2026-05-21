/**
 * Seed demo task graph into a live room via agent push (CRDT sync).
 *
 * Usage:
 *   npm run dev          # terminal 1
 *   npm run task:seed    # terminal 2
 */
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
import { buildDemoTaskOps } from "@slisync/sync-sdk/graph";

const ROOM_ID = process.env.SYNC_ROOM ?? "example-room";
const AGENT_ID = process.env.SYNC_AGENT_ID ?? "example-agent";
/** Node CLI has no `window`; default matches `npm run dev` (Next + Socket on :3000). */
const SYNC_URL =
  process.env.SYNC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SYNC_URL?.trim() ||
  "http://127.0.0.1:3000";
/** Aligns with Demo UI and `npm run graph:seed`. */
const DEMO_WORKSPACE_ID = "ws-demo";
const DEMO_SESSION_ID = "sess-demo";

async function main() {
  console.log(`[task:seed] sync=${SYNC_URL} room=${ROOM_ID}`);
  const graphOps = buildDemoTaskOps(
    AGENT_ID,
    DEMO_WORKSPACE_ID,
    DEMO_SESSION_ID,
  );

  const ack = await pushAgentMemory({
    url: SYNC_URL,
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    action: "seed_tasks",
    graphOps,
  });

  if (!ack.ok) {
    console.error("[task:seed] failed:", ack.error ?? "unknown");
    console.error(
      "[task:seed] hint: start sync first — terminal 1: `npm run dev`",
    );
    console.error(
      "  or standalone: `npm run sync:server` then SYNC_URL=http://127.0.0.1:3001 npm run task:seed",
    );
    process.exit(1);
  }

  console.log(
    `[task:seed] ok room=${ROOM_ID} v=${ack.version} ${ack.entry?.summary ?? ""}`,
  );
}

main().catch((err) => {
  console.error("[task:seed] error:", err);
  process.exit(1);
});
